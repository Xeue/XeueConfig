declare module 'xeue-config';
import type EventEmitter from "events";

export class Config extends EventEmitter {
    constructor(
        logger: Object
    );

	fromFile(
        filePath: string
    ): Promise<boolean>;

	fromCLI(
        filePath: string
    ): Promise<any>;

	fromAPI(
        filePath: string,
        requestFunction: Function,
        doneFunction: Function
    ): Promise<any>;

	userInput(
        callBack: Function
    ): void;

	doExitCheck(): void;

	set(
        property: string,
        value: any
    ): void;

	get(
        property: string
    ): any;

	all(): {};

	default(
        property: string,
        value: any
    ): void;

	require(
        property: string,
        values: any,
        question: string,
        dependancy?: (string | boolean)[]
    ): void;

	info(
        property: string,
        question: string,
        dependancy: string
    ): void;

	print(
        printFunction?: Function
    ): void;
}