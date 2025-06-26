import { java } from '../java/java';
import { render } from "../render/render";
import { microflows, IModel } from "mendixmodelsdk";
import { microflow } from './microflow';
import { javautils as ju } from '../java/utils';

export namespace microflowactivities {
    export abstract class AbstractActivity implements java.ICodeBlockItem {
        protected errorCodeBlock: microflow.IMicroflowCodeBlock | null = null;

        abstract render(indentIndex: number): render.CodeLine[];

        setErrorCodeBlock(errorCodeBlock: microflow.IMicroflowCodeBlock): void {
            this.errorCodeBlock = errorCodeBlock;
        }
    }

    export class LoopedActivity extends AbstractActivity {
        readonly loopedActivity: microflows.LoopedActivity;
        readonly model: IModel;
        readonly microflowCodeBlock: microflow.IMicroflowCodeBlock;

        constructor(loopedActivity: microflows.LoopedActivity, microflowCodeBlock: microflow.IMicroflowCodeBlock, model: IModel) {
            super();
            this.loopedActivity = loopedActivity;
            this.microflowCodeBlock = microflowCodeBlock;
            this.model = model;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            let loopSource = this.loopedActivity.loopSource;
            if (loopSource instanceof microflows.IterableList) {
                codeLines.push({indentIndex: indentIndex, content: `${ju.parseName(loopSource.listVariableName, ju.JavaName.MEMBER)}.forEach((${ju.parseName(loopSource.variableName, ju.JavaName.MEMBER)}) -> {`});
                codeLines = codeLines.concat(this.microflowCodeBlock.render(indentIndex + 1));
                codeLines.push({indentIndex: indentIndex, content: `});`});
            } else if (loopSource instanceof microflows.WhileLoopCondition) {
                throw `This type of action is not implemented yet: ${loopSource.structureTypeName}`;
            }
            return codeLines;
        }
    }
}