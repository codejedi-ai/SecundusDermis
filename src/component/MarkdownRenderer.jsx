// src/MarkdownRenderer.jsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const MarkdownRenderer = ({ markdown }) => {
    return (
        <ReactMarkdown>
            {markdown}
        </ReactMarkdown>
    );
};

export default MarkdownRenderer;