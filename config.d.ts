declare module 'xeue-config';

export class Config {
    constructor(
        logger: Object
    ): void;

	async fromFile(
        filePath: string
    ): boolean;

	async fromCLI(
        filePath: string
    ): void;

	async fromAPI(
        filePath: string,
        requestFunction: Function,
        doneFunction: Function
    ): void;

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
        dependancy: string
    ): void;

	info(
        property: string,
        question: string,
        dependancy: string
    ): void;

	print(
        printFunction: Function
    ): void;
}