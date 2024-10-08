declare module 'xeue-config';

export class Config extends EventEmitter {
    constructor(
        logger: Object
    ): void;

	async fromFile(
        filePath: string
    ): Promise<boolean>;

	async fromCLI(
        filePath: string
    ): Promise;

	async fromAPI(
        filePath: string,
        requestFunction: Function,
        doneFunction: Function
    ): Promise;

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