# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in VCF Sizer, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email the maintainer directly or use [GitHub Security Advisories](https://github.com/fjacquet/vcf-sizer/security/advisories/new).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.
4. You will receive an acknowledgment within 48 hours.

## Scope

VCF Sizer is a client-side-only application with no backend, no authentication, and no data persistence. The primary security concerns are:

- **Supply chain**: Malicious dependencies (mitigated by Dependabot and lock file)
- **XSS via URL state**: User-controlled URL parameters are validated through Zod schemas before use
- **Export injection**: Generated Markdown/PPTX content is derived from validated internal state
