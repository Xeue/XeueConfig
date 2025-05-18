declare module 'xeue-config';
import type EventEmitter from "events";

export class Config extends EventEmitter {
    constructor(
        logger: Object
    );

    path(
        filePath: string
    ): void;

	fromFile(
        file?: string
    ): Promise<boolean>;

	fromCLI(
        file?: string
    ): Promise<any>;

	fromAPI(
        file: string,
        requestFunction: Function,
        doneFunction: Function
    ): Promise<any>;

    write(
        file?: string
    ): void;

    writeObject(
        property: string
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
        property: string,
        filter?: any
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

    object(
        definition: any,
        defaults: any
    ): void;
}