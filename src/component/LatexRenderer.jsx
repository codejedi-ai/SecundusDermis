// src/LatexRenderer.jsx

import React from 'react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

const LatexRenderer = ({ latex }) => {
    return (
        <div>
            <Latex>{latex}</Latex>
        </div>
    );
};

export default LatexRenderer;