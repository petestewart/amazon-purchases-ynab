# Contributing to Amazon Purchases → YNAB Importer

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/amazon-purchases-ynab.git`
3. Install dependencies: `npm install`
4. Create a `.env` file based on `.env.example`
5. Run in development mode: `npm run dev`

## Development Workflow

### Code Style

We use ESLint and Prettier to maintain code quality and consistency.

- **Lint code**: `npm run lint`
- **Format code**: `npm run format`
- **Type check**: `npm run build`

Before committing, ensure:
- Code passes linting (`npm run lint`)
- Code is properly formatted (`npm run format`)
- TypeScript compiles without errors (`npm run build`)

### Making Changes

1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Write or update tests as needed
4. Update documentation if needed
5. Commit your changes with a clear message
6. Push to your fork
7. Open a pull request

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add support for Amazon international orders`
- `fix: correct tax calculation for multi-item orders`
- `docs: update setup instructions`
- `refactor: simplify email parsing logic`
- `test: add tests for price fetcher`

## Testing

### Manual Testing

Use the test script to test with sample emails:

```bash
./test-email.sh sample-email.html sample-email.txt
```

Or use curl directly:

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Automated Tests

Run the test suite:

```bash
npm test
```

Add tests for new features in the `src/**/*.test.ts` files.

## Project Structure

```
src/
├── config.ts              # Environment configuration
├── types.ts               # TypeScript types
├── index.ts               # Express server
├── services/              # Core business logic
│   ├── emailParser.ts     # Parse Amazon emails
│   ├── priceFetcher.ts    # Fetch prices from Amazon
│   ├── taxCalculator.ts   # Calculate proportional tax
│   ├── ynabClient.ts      # YNAB API client
│   └── orderProcessor.ts  # Orchestrator
└── utils/
    └── logger.ts          # Winston logger
```

## Adding New Features

### Email Parsing

If adding support for new email formats or providers:
1. Update `emailParser.ts` with new parsing logic
2. Add type definitions to `types.ts` if needed
3. Test with real email samples
4. Update documentation

### YNAB Integration

For changes to YNAB transaction creation:
1. Update `ynabClient.ts`
2. Follow [YNAB API documentation](https://api.ynab.com/)
3. Test with a test budget
4. Handle errors gracefully

### Price Fetching

For changes to Amazon price fetching:
1. Update `priceFetcher.ts`
2. Add appropriate delays to avoid rate limiting
3. Handle errors and fallbacks
4. Test with various product types

## Code Review Process

Pull requests will be reviewed for:

- **Functionality**: Does it work as intended?
- **Code quality**: Is it readable and maintainable?
- **Tests**: Are there adequate tests?
- **Documentation**: Is it documented?
- **Style**: Does it follow our conventions?

## Reporting Issues

When reporting bugs, please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Email sample (with sensitive data removed)
- Log output
- Environment (Node version, OS, etc.)

## Questions?

Feel free to open an issue for questions or discussion!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
