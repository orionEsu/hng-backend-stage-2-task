# Stage 1 Task: String Analyzer Service

A RESTful API built with pure Node.js and TypeScript that analyzes strings, computes their properties (length, palindrome status, character frequency, SHA-256 hash), and stores them in memory with advanced filtering capabilities including natural language query processing with In-memory storage using JavaScript `Map`. AI was used to build the NLP feature (I was behind time and needed it done asap)

## Project Files

- `server.ts` — main server implementation with all API endpoints
- `package.json` — scripts and devDependencies
- `README.md` — this file

## Prerequisites

- Node.js
- npm

**Note:** This project uses pure Node.js with TypeScript and runs via the `tsx` runner in development. All required packages are listed as devDependencies in `package.json`. No external frameworks or databases are used - all data is stored in-memory using JavaScript Map.

## Install Dependencies

Open a terminal in the project root and run:
```bash
npm install
```

This installs the following devDependencies declared in `package.json`:
- `typescript` — TypeScript compiler
- `tsx` — fast TypeScript runner for development
- `@types/node` — Node.js type definitions

No additional runtime dependencies are required.

## Run Locally

**Development (watch & run TypeScript directly):**
```bash
npm run dev
```

This uses `tsx watch server.ts` to run the server and reload on file changes.

**Build (compile to JavaScript) and run:**
```bash
npm run build
npm start
```

`npm run build` runs `tsc` and produces compiled output in `dist/`; `npm start` runs `node dist/server.js`.

## API Endpoints

The server listens by default on `http://127.0.0.1:3000`.

### 1. Create/Analyze String

**POST** `/strings`

Analyzes a string and stores its properties.

**Request body:**
```json
{
  "value": "hello world"
}
```

**Response (201 Created):**
```json
{
  "id": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "value": "hello world",
  "properties": {
    "length": 11,
    "is_palindrome": false,
    "unique_characters": 8,
    "word_count": 2,
    "sha256_hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "character_frequency_map": {
      "h": 1,
      "e": 1,
      "l": 3,
      "o": 2,
      " ": 1,
      "w": 1,
      "r": 1,
      "d": 1
    }
  },
  "created_at": "2025-10-22T10:30:00.000Z"
}
```

**Error responses:**
- `409 Conflict` — String already exists
- `400 Bad Request` — Missing or invalid request body
- `422 Unprocessable Entity` — Invalid data type for "value"

### 2. Get Specific String

**GET** `/strings/{string_value}`

Retrieves a previously analyzed string by its value.

**Example:**
```bash
curl http://127.0.0.1:3000/strings/hello%20world
```

**Response (200 OK):** Same structure as POST response

**Error responses:**
- `404 Not Found` — String does not exist

### 3. Get All Strings with Filtering

**GET** `/strings?is_palindrome=true&min_length=5&max_length=20&word_count=2&contains_character=a`

Returns all strings with optional filters.

**Query parameters:**
- `is_palindrome` — boolean (`true` or `false`)
- `min_length` — integer (minimum string length)
- `max_length` — integer (maximum string length)
- `word_count` — integer (exact word count)
- `contains_character` — string (single character to search for)

**Example:**
```bash
curl "http://127.0.0.1:3000/strings?is_palindrome=true&word_count=1"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "hash1",
      "value": "racecar",
      "properties": { ... },
      "created_at": "2025-10-22T10:00:00Z"
    }
  ],
  "count": 1,
  "filters_applied": {
    "is_palindrome": true,
    "word_count": 1
  }
}
```

### 4. Natural Language Filtering

**GET** `/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings`

Filter strings using natural language queries.

**Supported query patterns:**
- `"all single word palindromic strings"` → `word_count=1, is_palindrome=true`
- `"strings longer than 10 characters"` → `min_length=11`
- `"strings containing the letter z"` → `contains_character=z`
- `"palindromic strings that contain the first vowel"` → `is_palindrome=true, contains_character=a`

**Example:**
```bash
curl "http://127.0.0.1:3000/strings/filter-by-natural-language?query=single%20word%20palindromes"
```

**Response (200 OK):**
```json
{
  "data": [ ... ],
  "count": 2,
  "interpreted_query": {
    "original": "single word palindromes",
    "parsed_filters": {
      "word_count": 1,
      "is_palindrome": true
    }
  }
}
```

**Error responses:**
- `400 Bad Request` — Unable to parse natural language query
- `422 Unprocessable Entity` — Query parsed but resulted in conflicting filters

### 5. Delete String

**DELETE** `/strings/{string_value}`

Removes a string from storage.

**Example:**
```bash
curl -X DELETE http://127.0.0.1:3000/strings/hello%20world
```

**Response (204 No Content):** Empty response body

**Error responses:**
- `404 Not Found` — String does not exist
