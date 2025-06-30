import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'

interface LatexRendererProps {
    latex: string
}

const LatexRenderer = ({ latex }: LatexRendererProps) => {
    return (
        <div>
            <Latex>{latex}</Latex>
        </div>
    )
}

export default LatexRenderer