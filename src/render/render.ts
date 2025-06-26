export namespace render {
    export interface IRenderable {
        render(indentIndex: number): CodeLine[];
    }

    export interface CodeLine {
        indentIndex: number;
        content: string;
    }

    export function renderCodeLines(codeLines: CodeLine[]): string {
        let codeLinesString: string = ''
        codeLines.forEach(codeLine => {
            let indentString: string = '';
            for(let i = 0; i < codeLine.indentIndex; i++) { 
                indentString += '\t';
             } 
            codeLinesString += indentString + codeLine.content + '\n';
        });
        return codeLinesString;
    }

    export function blankLine(): CodeLine {
        return {indentIndex: 0, content: ''};
    }
}