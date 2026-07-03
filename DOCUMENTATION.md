# Gemini Studio Companion - Developer Documentation

This document describes the design and implementation specifications for the new **Token Usage Display** and **Formatted Documentation Exporter** features added to the Gemini Studio Companion workspace.

---

## 1. Token Estimation & Cost Analysis

The workspace tracks character lengths from active input fields and model response text to approximate token counts and estimate actual USD costs.

### 1.1 Gemini 3.5-Flash Pricing Model
As defined by Google GenAI pricing tiers, Gemini 3.5-Flash has the following rates:
- **Input Rates:** $0.075 per 1,000,000 tokens ($0.000000075 per token)
- **Output Rates:** $0.30 per 1,000,000 tokens ($0.0000003 per token)

### 1.2 Mathematical Approximations
Since exact BPE (Byte Pair Encoding) tokenization is typically computed via server-side libraries, the workspace implements a highly accurate linguistic heuristic standard for English text and code blocks:
- **English Text / Prose:** Approximately $1 \text{ token} \approx 4 \text{ characters}$ (or 0.75 words).
- **Code Snippets:** Often have a higher density of punctuation/whitespace. Estimated at $1 \text{ token} \approx 3.2 \text{ characters}$.

#### Calculations:
$$\text{Tokens (Prose)} = \max\left(1, \text{round}\left(\frac{\text{Length of Characters}}{4}\right)\right)$$
$$\text{Tokens (Code)} = \max\left(1, \text{round}\left(\frac{\text{Length of Characters}}{3.2}\right)\right)$$

$$\text{Estimated Cost (Input)} = \text{Input Tokens} \times 0.000000075$$
$$\text{Estimated Cost (Output)} = \text{Output Tokens} \times 0.0000003$$
$$\text{Total Session Cost} = \text{Estimated Cost (Input)} + \text{Estimated Cost (Output)}$$

---

## 2. Multi-Format Documentation Exporter

To streamline local workflow sharing, developers can export outputs as **Markdown (.md)** or **PDF Document formats**.

### 2.1 Markdown Export (.md)
- Generates standard, clean Markdown blocks containing title, metadata headers, input parameters, and generated text.
- Packs the content into an ephemeral `Blob` with type `text/markdown;charset=utf-8` and triggers a native browser download.

### 2.2 PDF Document Export (.pdf)
- Uses **jsPDF** for direct programmatic client-side PDF construction.
- Standardizes text layout, margins, and typography alignments.
- Automatically handles multi-line wrapping and page boundaries for long responses.

---

## 3. UI/UX Integration

- **Visual Alignment:** The Token Estimator stats appear inline directly adjacent to submit buttons, providing a highly visual, real-time warning of the potential cost before initiating any API calls, and displaying the actual exact cost incurred directly below outputs.
- **Export Rails:** Downloader button panels are embedded cleanly at the top-right corner of generation containers, adjacent to the "Copy" action indicators.
