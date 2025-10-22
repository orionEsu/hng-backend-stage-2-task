import http from "http";
import { createHash } from "crypto";
import { URL } from "url";
import { json } from "stream/consumers";

type Properties = {
  length: number;
  unique_characters: number;
  is_palindrome: boolean;
  word_count: number;
  sha256_hash: string;
  character_frequency_map: { [key: string]: number };
};

type Response = {
  id: string;
  value: string;
  properties: Properties;
  created_at: string;
};

const stringDB = new Map<
  string,
  {
    id: string;
    value: string;
    properties: Properties;
    created_at: string;
  }
>();

const server = http.createServer((req, res) => {
  const { method } = req;
  const urlString = new URL(req.url as string, `http://${req.headers.host}`);
  const pathname = urlString.pathname;
  const params = urlString.searchParams;

  if (method === "POST" && pathname === "/strings") {
    let data = "";

    req.on("data", (chunks) => {
      data += chunks.toString();
    });

    req.on("end", () => {
      try {
        const parsedData = JSON.parse(data) as { value: string };

        if (!parsedData.value) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Bad request",
              message: "Missing 'value' field",
            }),
          );

          return;
        }

        if (typeof parsedData.value !== "string") {
          res.writeHead(422, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Unprocessable Entity",
              message: "Invalid data type for 'value' (must be string)",
            }),
          );
          return;
        }

        const stringValue = parsedData.value;
        const hash = generateHash(stringValue);

        if (stringDB.has(hash)) {
          res.writeHead(409, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Conflict",
              message: "String already exists in the system",
            }),
          );

          return;
        }

        const properties = {
          length: checkLength(stringValue),
          is_palindrome: isPalindrome(stringValue),
          unique_characters: countUniqueChars(stringValue),
          word_count: countWords(stringValue),
          sha256_hash: hash,
          character_frequency_map: getCharFrequency(stringValue),
        };

        const stringObj = {
          id: hash,
          value: stringValue,
          properties: properties,
          created_at: new Date().toISOString(),
        };

        stringDB.set(hash, stringObj);

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(stringObj));
      } catch (error) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad request",
            message: "Invalid JSON in request body",
          }),
        );
      }
    });

    req.on("error", (error) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to process request",
        }),
      );
    });
  } else if (
    method === "GET" &&
    pathname === "/strings/filter-by-natural-language"
  ) {
    const query = params.get("query");

    if (!query) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "query parameter is required",
        }),
      );
      return;
    }

    const parsedFilters = parseNaturalLanguageQuery(query);

    if (!parsedFilters) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Unable to parse natural language query",
        }),
      );
      return;
    }

    // Check for conflicting filters
    if (hasConflictingFilters(parsedFilters)) {
      res.writeHead(422, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unprocessable Entity",
          message: "Query parsed but resulted in conflicting filters",
        }),
      );
      return;
    }

    const results = applyFilters(parsedFilters);

    const response = {
      data: results,
      count: results.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
    };

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));
  } else if (method === "GET" && pathname.startsWith("/strings/")) {
    const stringValue = pathname.substring("/strings/".length);
    const decodedValue = decodeURIComponent(stringValue);

    const hash = generateHash(decodedValue);

    const foundString = stringDB.has(hash);

    if (!foundString) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Not Found",
          message: "String does not exist in system",
        }),
      );

      return;
    }

    const stringObj = stringDB.get(hash);

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(stringObj));
  } else if (method === "GET" && pathname === "/strings") {
    const stringsArray = Array.from(stringDB.values());

    const isPalindromeParam = params.get("is_palindrome");
    const minLengthParam = params.get("min_length");
    const maxLengthParam = params.get("max_length");
    const wordCountParam = params.get("word_count");
    const containsCharParam = params.get("contains_character");

    const filtersApplied = {} as {
      is_palindrome: boolean;
      min_length: number;
      max_length: number;
      word_count: number;
      contains_character: string;
    };
    let filteredStrings = stringsArray;

    if (isPalindromeParam !== null) {
      const isPalindrome = isPalindromeParam === "true";
      filtersApplied.is_palindrome = isPalindrome;
      filteredStrings = filteredStrings.filter(
        (str) => str.properties.is_palindrome === isPalindrome,
      );
    }

    if (minLengthParam) {
      const minLength = Number(minLengthParam);
      if (isNaN(minLength)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad request",
            message: "min_length must be a valid number",
          }),
        );

        return;
      }
      filtersApplied.min_length = minLength;
      filteredStrings = filteredStrings.filter(
        (str) => str.properties.length >= minLength,
      );
    }

    if (maxLengthParam) {
      const maxLength = Number(maxLengthParam);
      if (isNaN(maxLength)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad request",
            message: "max_length must be a valid number",
          }),
        );

        return;
      }
      filtersApplied.max_length = maxLength;
      filteredStrings = filteredStrings.filter(
        (str) => str.properties.length <= maxLength,
      );
    }

    if (wordCountParam) {
      const wordCount = Number(wordCountParam);
      if (isNaN(wordCount)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad request",
            message: "word_count must be a valid number",
          }),
        );

        return;
      }
      filtersApplied.word_count = wordCount;
      filteredStrings = filteredStrings.filter(
        (str) => str.properties.word_count === wordCount,
      );
    }

    if (containsCharParam) {
      if (containsCharParam.length !== 1) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad request",
            message: "contains_character must be a single character",
          }),
        );
        return;
      }

      filtersApplied.contains_character = containsCharParam;
      filteredStrings = filteredStrings.filter((str) =>
        str.value.includes(containsCharParam),
      );
    }

    const response = {
      data: filteredStrings,
      count: filteredStrings.length,
      filters_applied: filtersApplied,
    };

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));
  } else if (method === "DELETE" && pathname.startsWith("/strings/")) {
    const stringValue = pathname.substring("/strings/".length);
    const decodedValue = decodeURIComponent(stringValue);

    const hash = generateHash(decodedValue);

    const foundString = stringDB.has(hash);

    if (!foundString) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Not found",
          message: "String does not exist in the system",
        }),
      );

      return;
    }

    stringDB.delete(hash);

    res.writeHead(204, { "content-type": "application/json" });
    res.end();
  } else {
    res.writeHead(404).end("Not found");
  }
});

function checkLength(val: string) {
  return val.length;
}

function isPalindrome(str: string) {
  const newStr = str;
  const cleaned = str.toLowerCase().replace(/\s+/g, "");

  const reversedString = cleaned.split("").reverse().join("");

  return cleaned === reversedString;
}

function countUniqueChars(str: string) {
  const uniqueSet = new Set(str);

  return uniqueSet.size;
}

function countWords(str: string) {
  return str.split(/\s+/).length;
}

function generateHash(str: string) {
  return createHash("sha-256").update(str).digest("hex");
}

function getCharFrequency(str: string) {
  const frequency: { [key: string]: number } = {};

  for (const char of str) {
    // frequency[char] = (frequency[char] ||0) +1
    if (frequency[char]) {
      frequency[char]++;
    } else {
      frequency[char] = 1;
    }
  }

  return frequency;
}

function parseNaturalLanguageQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  const filters: any = {};

  // Pattern 1: Detect "palindrome" or "palindromic"
  if (lowerQuery.includes("palindrome") || lowerQuery.includes("palindromic")) {
    filters.is_palindrome = true;
  }

  // Pattern 2: Detect "single word" or "one word"
  if (lowerQuery.match(/\b(single|one)\s+word\b/)) {
    filters.word_count = 1;
  }

  // Pattern 3: Detect "two word" or "2 word"
  if (lowerQuery.match(/\b(two|2)\s+words?\b/)) {
    filters.word_count = 2;
  }

  // Pattern 4: Detect "N word" (any number)
  const wordCountMatch = lowerQuery.match(/\b(\d+)\s+words?\b/);
  if (wordCountMatch) {
    filters.word_count = parseInt(wordCountMatch[1]);
  }

  // Pattern 5: Detect "longer than N" or "more than N characters"
  const longerThanMatch = lowerQuery.match(
    /\b(?:longer|more)\s+than\s+(\d+)(?:\s+characters?)?\b/,
  );
  if (longerThanMatch) {
    filters.min_length = parseInt(longerThanMatch[1]) + 1;
  }

  // Pattern 6: Detect "shorter than N" or "less than N characters"
  const shorterThanMatch = lowerQuery.match(
    /\b(?:shorter|less)\s+than\s+(\d+)(?:\s+characters?)?\b/,
  );
  if (shorterThanMatch) {
    filters.max_length = parseInt(shorterThanMatch[1]) - 1;
  }

  // Pattern 7: Detect "at least N characters"
  const atLeastMatch = lowerQuery.match(
    /\bat\s+least\s+(\d+)(?:\s+characters?)?\b/,
  );
  if (atLeastMatch) {
    filters.min_length = parseInt(atLeastMatch[1]);
  }

  // Pattern 8: Detect "exactly N characters"
  const exactlyMatch = lowerQuery.match(
    /\bexactly\s+(\d+)(?:\s+characters?)?\b/,
  );
  if (exactlyMatch) {
    const length = parseInt(exactlyMatch[1]);
    filters.min_length = length;
    filters.max_length = length;
  }

  // Pattern 9: Detect "containing letter X" or "contains the letter X"
  const containsLetterMatch = lowerQuery.match(
    /\bcontain(?:s|ing)?\s+(?:the\s+)?letter\s+([a-z])\b/,
  );
  if (containsLetterMatch) {
    filters.contains_character = containsLetterMatch[1];
  }

  // Pattern 10: Detect "with the letter X" or "with letter X"
  const withLetterMatch = lowerQuery.match(
    /\bwith\s+(?:the\s+)?letter\s+([a-z])\b/,
  );
  if (withLetterMatch) {
    filters.contains_character = withLetterMatch[1];
  }

  // Pattern 11: Detect "first vowel" (a), "second vowel" (e), etc.
  const vowels = ["a", "e", "i", "o", "u"];
  const vowelPositions = ["first", "second", "third", "fourth", "fifth"];

  vowelPositions.forEach((position, index) => {
    if (lowerQuery.includes(`${position} vowel`)) {
      filters.contains_character = vowels[index];
    }
  });

  // Return null if no filters were parsed
  if (Object.keys(filters).length === 0) {
    return null;
  }

  return filters;
}

function applyFilters(filters: any) {
  const stringsArray = Array.from(stringDB.values());
  let filteredStrings = stringsArray;

  // Apply is_palindrome filter
  if (filters.is_palindrome !== undefined) {
    filteredStrings = filteredStrings.filter(
      (str) => str.properties.is_palindrome === filters.is_palindrome,
    );
  }

  // Apply min_length filter
  if (filters.min_length !== undefined) {
    filteredStrings = filteredStrings.filter(
      (str) => str.properties.length >= filters.min_length,
    );
  }

  // Apply max_length filter
  if (filters.max_length !== undefined) {
    filteredStrings = filteredStrings.filter(
      (str) => str.properties.length <= filters.max_length,
    );
  }

  // Apply word_count filter
  if (filters.word_count !== undefined) {
    filteredStrings = filteredStrings.filter(
      (str) => str.properties.word_count === filters.word_count,
    );
  }

  // Apply contains_character filter
  if (filters.contains_character !== undefined) {
    filteredStrings = filteredStrings.filter((str) =>
      str.value.includes(filters.contains_character),
    );
  }

  return filteredStrings;
}

function hasConflictingFilters(filters: any): boolean {
  // Check if min_length > max_length
  if (
    filters.min_length !== undefined &&
    filters.max_length !== undefined &&
    filters.min_length > filters.max_length
  ) {
    return true;
  }

  return false;
}

server.listen(3000, () => {
  console.log("Port is running on 3000");
});
