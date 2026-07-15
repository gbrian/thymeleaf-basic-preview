# 🌿 Thymeleaf Basic Preview

> A lightweight VSCode extension to preview Thymeleaf HTML templates during development — no server required.

![VSCode](https://img.shields.io/badge/VSCode-1.85+-blue?logo=visualstudiocode)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-dev--tool-orange)

---

## ✨ What it does

When working with Thymeleaf templates (e.g. email reports, PDF layouts) in a Spring Boot project, you normally need to run the full application to see a rendered output. This extension eliminates that friction by resolving Thymeleaf expressions directly inside VSCode using a companion `.json` data file and an optional `.properties` i18n file.

---

## 📦 Installation

### From `.vsix` (recommended for dev use)

```bash
# 1. Clone / navigate to the extension folder
cd thymeleaf-basic-preview-vscode

# 2. Install dependencies
npm install

# 3. Compile and package
npm run package

# 4. Install in VSCode
#    Ctrl+Shift+P → "Extensions: Install from VSIX..."
#    Select: thymeleaf-basic-preview-0.0.1.vsix
```

---

## 🚀 Usage

### 1. Open your Thymeleaf template

Open any `.html` Thymeleaf file in the VSCode editor.

```
templates/
└── mro-management/
    ├── activity-report-template.html        ← open this
    ├── activity-report-template.json        ← data file
    └── activity-report-template.properties  ← i18n file (optional)
```

### 2. Click the Preview icon

Click the **👁 Open Thymeleaf Preview** icon in the editor title bar (top right).

A side panel opens with the fully rendered template.

---

## 📁 File Conventions

The extension looks for companion files with the **same base name** as the template, in the **same folder**:

| File | Purpose | Required |
|------|---------|----------|
| `template.html` | Your Thymeleaf template | ✅ |
| `template.json` | Variable data for `${var}` expressions | ⚠️ Recommended |
| `template.properties` | i18n key/value pairs for `#{KEY}` | ❌ Optional |

---

## 📄 Data File Examples

### `activity-report-template.json`

```json
{
  "day": "01",
  "month": "08",
  "year": "2024",
  "aircraftRegistration": "EC-ROR",
  "technician": "John Doe",
  "mro": "BRK",
  "location": "MAD"
}
```

### `activity-report-template.properties`

```properties
MRO.ACTIVITY-REPORT=Activity Report
MRO.REPORT-SUMMARY=Report Summary
MRO.AIRCRAFT=Aircraft:
MRO.TECHNICIAN=Technician:
MRO.MRO=MRO:
MRO.LOCATION=Location:
MRO.REPORT-CONFIRMATION=Report Confirmation
MRO.ACTIVITY-REPORT-SUBMITTED=This activity report has been successfully submitted.
MRO.AUTOMATED-MESSAGE=This is an automated message. Please do not reply to this email.
```

---

## ✅ Supported Thymeleaf Syntax

| Syntax | Example | Supported |
|--------|---------|-----------|
| `th:text` + variable | `th:text="${aircraftRegistration}"` | ✅ |
| `th:text` + i18n key | `th:text="#{MRO.AIRCRAFT}"` | ✅ |
| `th:text` + concatenation | `th:text="'Date: ' + ${day} + '/' + ${month}"` | ✅ |
| `th:text` + literal substitution | `th:text="\|Hello ${name}\|"` | ✅ |
| Inline `${var}` in text | `<p>${message}</p>` | ✅ |
| Inline `#{key}` in text | `<p>#{MRO.TITLE}</p>` | ✅ |
| Dot notation access | `${user.name}` | ✅ |
| `xmlns:th` namespace | stripped automatically | ✅ |

---

## 🔍 Preview Panel

The preview opens in a **side panel** next to your editor and includes a small dev toolbar:

```
┌─────────────────────────────────────────────────┐
│ 🌿 Thymeleaf Preview  activity-report.html  DEV │  ← toolbar
├─────────────────────────────────────────────────┤
│                                                 │
│   Activity Report                               │
│   Report Date: 01/08/2024                       │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │ Report Summary                          │   │
│   │ Aircraft:   EC-ROR                      │   │
│   │ Technician: John Doe                    │   │
│   │ MRO:        BRK                         │   │
│   │ Location:   MAD                         │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

> If a variable is missing from the JSON, it renders as `{{varName}}` so you can spot missing data at a glance.

---

## 🏗️ Project Structure

```
thymeleaf-basic-preview-vscode/
├── src/
│   └── extension.ts       # Core extension logic
├── out/                   # Compiled JS (generated)
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
├── .vscodeignore          # Files excluded from .vsix
├── LICENSE                # MIT License
└── README.md              # This file
```

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Compile TypeScript (watch mode)
npm run watch

# Press F5 in VSCode to launch Extension Development Host

# Build .vsix package
npm run package
```

---

## 🏢 Project Context

This extension was built to support the **@gbrian MRO Management** platform.

Templates are used for:
- ✈️ Aircraft activity reports
- 🔧 MRO technician notifications
- 📋 Work order confirmations

Backend: [`app-mvn-mro-management-api`](../mro/app-mvn-mro-management-api) — Spring Boot + Thymeleaf

---

## ⚠️ Limitations

This is a **dev-only preview tool**, not a full Thymeleaf engine. The following are **not** supported:

- `th:if` / `th:unless` conditionals
- `th:each` loops
- `th:fragment` / `th:replace` / `th:insert`
- `th:href`, `th:src`, `th:action`
- Spring Security dialect
- Complex SpEL expressions

---

## 📝 License

[MIT](./LICENSE) © 2024 @gbrian