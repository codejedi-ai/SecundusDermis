// src/App.jsx

import React, { useState } from 'react';
import LatexRenderer from './component/LatexRenderer';
import MarkdownRenderer from './component/MarkdownRenderer';
import MermaidRenderer from './component/MermaidRenderer';
import example from './example';
function App() {
    const [latexTextDouble] = useState('$$\\int_{0}^{\\infty} x^2 dx$$');
    const [latexTextSingle] = useState('$\\int_{0}^{\\infty} x^2 dx$');
    const [markdownText] = useState('# Hello, world!\n\nThe quadratic formula is given by:');

    return (
        <div style={{ padding: '20px' }}>
          <h1>LaTeX Renderer Single</h1>
          <LatexRenderer latex={latexTextSingle} />
            <h1>LaTeX Renderer Double</h1>
            <LatexRenderer latex={latexTextDouble} />
            <h1>Markdown Renderer</h1>
            <MarkdownRenderer markdown={markdownText} />
            <h1>Mermaid Diagram</h1>
            <MermaidRenderer chart={example}/>
        </div>
    );
}

export default App;