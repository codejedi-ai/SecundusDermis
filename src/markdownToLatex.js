// src/markdownToLatex.js

export const markdownToLatex = (markdown) => {
    // Basic conversion logic (this can be expanded based on needs)
    return markdown
        .replace(/#/g, '\\section') // Convert headers
        .replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}') // Convert bold text
        .replace(/\*(.*?)\*/g, '\\textit{$1}'); // Convert italic text
};