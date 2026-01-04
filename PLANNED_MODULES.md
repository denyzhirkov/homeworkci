# Planned Modules Roadmap

This document tracks modules that are planned or could be useful additions to HomeworkCI. Modules are organized by priority and status.

## High Priority

### yaml
**Status:** Planned  
**Description:** YAML parsing and generation operations  
**Use Cases:**
- Parse Kubernetes manifests
- Generate Docker Compose configurations
- Work with CI/CD config files (GitHub Actions, GitLab CI)
- Similar to `json` module but for YAML format

**Operations:**
- `parse` - Parse YAML string to object
- `stringify` - Convert object to YAML string
- `get` - Extract value by path
- `set` - Modify value at path
- `merge` - Merge YAML objects

---

### env
**Status:** Planned  
**Description:** Read/write `.env` files  
**Use Cases:**
- Load environment variables from `.env` files
- Generate `.env` files from templates
- Manage environment-specific configurations
- Support `.env`, `.env.production`, `.env.development` patterns

**Operations:**
- `read` - Read and parse `.env` file
- `write` - Write variables to `.env` file
- `get` - Get specific variable value
- `set` - Set/update variable value

---

### validate
**Status:** Planned  
**Description:** Data validation operations  
**Use Cases:**
- Validate JSON/YAML schemas
- Validate data formats (email, URL, version numbers)
- Regex pattern matching
- Type checking

**Operations:**
- `schema` - Validate against JSON Schema
- `format` - Validate format (email, url, version, etc.)
- `regex` - Pattern matching
- `required` - Check required fields

---

### template
**Status:** Planned  
**Description:** Template rendering with variable substitution  
**Use Cases:**
- Generate configuration files from templates
- Create deployment manifests
- Dynamic file generation
- Support Handlebars/Mustache-like syntax

**Operations:**
- `render` - Render template with variables
- `renderFile` - Render template file
- Support conditionals and loops

---

### retry
**Status:** Planned  
**Description:** Retry wrapper for steps with automatic retries  
**Use Cases:**
- Handle transient network failures
- Retry flaky operations
- Exponential backoff strategies
- Configurable retry attempts and delays

**Parameters:**
- `maxAttempts` - Maximum retry attempts
- `delay` - Initial delay in ms
- `backoff` - Exponential backoff multiplier
- `onError` - Error pattern matching

---

## Medium Priority

### email
**Status:** Planned  
**Description:** Send email notifications via SMTP  
**Use Cases:**
- Send build notifications
- Alert on pipeline failures
- Report generation
- HTML and plain text emails with attachments

**Parameters:**
- `smtp` - SMTP server configuration
- `from`, `to`, `cc`, `bcc` - Email addresses
- `subject`, `body` - Email content
- `html` - HTML email body
- `attachments` - File attachments

---

### git (extended)
**Status:** Enhancement  
**Description:** Extend existing `git` module with more operations  
**Current:** `clone`, `pull`  
**Planned:**
- `commit` - Commit changes
- `push` - Push to remote
- `tag` - Create/manage tags
- `checkout` - Switch branches
- `branch` - Create/delete branches
- `status` - Get repository status
- `log` - Get commit history
- Auto-detect git info (branch, commit, author) for use in variables

---

### docker-registry
**Status:** Planned  
**Description:** Interact with Docker registries  
**Use Cases:**
- Push/pull Docker images
- Tag images
- Check if image exists
- List repository tags
- Support Docker Hub, GitLab Registry, AWS ECR, etc.

**Operations:**
- `push` - Push image to registry
- `pull` - Pull image from registry
- `tag` - Tag image
- `exists` - Check if image exists
- `list` - List tags in repository

---

### wait
**Status:** Planned  
**Description:** Wait for conditions to be met  
**Use Cases:**
- Wait for HTTP endpoint to be available
- Wait for file to appear
- Wait for process to complete
- Health check polling

**Operations:**
- `http` - Wait for HTTP endpoint (200 status)
- `file` - Wait for file to exist
- `process` - Wait for process to finish
- `custom` - Custom condition function

**Parameters:**
- `timeout` - Maximum wait time
- `interval` - Polling interval
- `retries` - Number of attempts

---

### crypto
**Status:** Planned  
**Description:** Cryptographic operations  
**Use Cases:**
- Hash generation (MD5, SHA256, SHA512)
- Base64 encoding/decoding
- Hex encoding/decoding
- Generate random strings/tokens
- Encrypt/decrypt secrets

**Operations:**
- `hash` - Generate hash (MD5, SHA256, etc.)
- `encode` - Base64/Hex encoding
- `decode` - Base64/Hex decoding
- `random` - Generate random string/token
- `encrypt` - Encrypt data (AES)
- `decrypt` - Decrypt data

---

## Low Priority

### db
**Status:** Future  
**Description:** Database operations  
**Use Cases:**
- Execute SQL queries
- Run database migrations
- Connect to PostgreSQL, MySQL, SQLite
- Requires database drivers

**Operations:**
- `query` - Execute SQL query
- `migrate` - Run migration scripts
- `connect` - Establish connection

**Note:** Complex implementation, requires external dependencies

---

### kubernetes
**Status:** Future  
**Description:** Kubernetes API operations  
**Use Cases:**
- Apply manifests
- Get pod status
- Scale deployments
- Requires kubectl or K8s API client

**Operations:**
- `apply` - Apply manifest
- `get` - Get resource status
- `scale` - Scale deployment
- `delete` - Delete resource

**Note:** Requires kubectl or K8s API access

---

### queue
**Status:** Future  
**Description:** Message queue operations  
**Use Cases:**
- Send/receive messages from RabbitMQ, Redis
- Publish events
- Async task processing

**Operations:**
- `publish` - Publish message
- `consume` - Consume message
- `subscribe` - Subscribe to queue

---

### cache
**Status:** Future  
**Description:** Caching and change detection  
**Use Cases:**
- Cache step results
- Skip steps if inputs haven't changed
- Speed up builds by reusing cached results
- Hash-based change detection

**Operations:**
- `get` - Get cached value
- `set` - Cache value
- `hasChanged` - Check if inputs changed
- `clear` - Clear cache

---

### lock
**Status:** Future  
**Description:** Distributed locking  
**Use Cases:**
- Prevent parallel runs of same pipeline
- Critical section protection
- Distributed locks

**Operations:**
- `acquire` - Acquire lock
- `release` - Release lock
- `tryLock` - Try to acquire lock (non-blocking)

---

### transform
**Status:** Future  
**Description:** Data format transformations  
**Use Cases:**
- CSV ↔ JSON conversion
- XML ↔ JSON conversion
- Data format conversions

**Operations:**
- `csvToJson` - Convert CSV to JSON
- `jsonToCsv` - Convert JSON to CSV
- `xmlToJson` - Convert XML to JSON
- `jsonToXml` - Convert JSON to XML

---

### test
**Status:** Future  
**Description:** Test execution and reporting  
**Use Cases:**
- Run test frameworks (JUnit, Mocha, Jest)
- Parse test results
- Generate test reports
- Test coverage reporting

**Operations:**
- `run` - Run test suite
- `parse` - Parse test results
- `report` - Generate report

---

### secret
**Status:** Future  
**Description:** Secret management integration  
**Use Cases:**
- Integrate with HashiCorp Vault
- AWS Secrets Manager
- Secure secret retrieval
- Key rotation

**Operations:**
- `get` - Get secret
- `set` - Set secret
- `rotate` - Rotate key

---

## Implementation Notes

- Modules should follow the existing pattern: `modules/{name}.ts`
- Each module must export `schema` and `run` function
- Modules should support variable interpolation in parameters
- Error handling should be consistent with existing modules
- Documentation should be added to both README.md and Documentation.tsx

## Module Status Legend

- **Planned** - Design discussed, ready for implementation
- **Enhancement** - Extending existing module
- **Future** - Long-term consideration, may require significant work

