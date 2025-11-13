import fs from 'fs';
import { Logs, Level, LevelText, CustomLevel } from 'xeue-logs';
import readline from 'readline';
import EventEmitter from 'events';
import path from 'path';

export class Config extends EventEmitter {
    Logs: Logs
    defaults: { [key: string]: any } = {}
    required: { [key: string]: any } = {}
    dependancies: { [key: string]: any } = {}
    questions: { [key: string]: string } = {}
    config: { [key: string]: any } = {}
    filePath: string = './'
    objects: { [key: string]: ObjectDefinition } = {}
    logerLevel: Level = 'H'
    configLevel: CustomLevel
    blankLevel: CustomLevel
    constructor(
        logger: Logs
    ) {
        super();
        if (logger) {
            this.Logs = logger;
        } else {
            this.Logs = new Logs(
                false,
                'configLogging',
                './configLogging',
                'D'
            );
        }
        this.configLevel = [this.logerLevel, 'CONFIG', this.Logs.c]
        this.blankLevel = [this.logerLevel, '', this.Logs.c]
    }

    //Set the path to save config to
    path(filePath: string) {
        this.filePath = filePath;
    }

    //Load config from <file>
    async fromFile(file = 'config.conf') {
        if (!fs.existsSync(this.filePath)) {
            fs.mkdirSync(this.filePath, {
                recursive: true
            });
        }
        try {
            const configData = await fs.promises.readFile(path.join(this.filePath, file));
            const fileObject = JSON.parse(configData.toString());
            for (const key in fileObject) {
                if (Object.hasOwnProperty.call(fileObject, key)) {
                    this.config[key] = fileObject[key];
                }
            }
            return true;
        } catch (error) {
            this.Logs.warn('There is an error with the config file or it doesn\'t exist', error);
            return false;
        }
    }

    //Create config from CLI entry
    async fromCLI(file = 'config.conf', timeoutSeconds = 0) {
        console.log(process.stdout.isTTY);
        if (!process.stdout.isTTY) {
            this.write(file);
            return;
        }

        let timeOut: NodeJS.Timeout;
        if (timeoutSeconds != 0) {
            this.Logs.force(`If no input is detected for ${this.Logs.y}${timeoutSeconds}${this.Logs.reset} seconds, the default configuration will be used`, this.configLevel);
            const startTime = timeoutSeconds;
            timeOut = setInterval(() => {
                if (timeoutSeconds < 1) {
                    this.Logs.force(`No input for ${this.Logs.y}${startTime}${this.Logs.reset} seconds, default config will be used`, this.configLevel);
                    this.Logs.emit('cancelInput');
                    clearTimeout(timeOut);
                } else {
                    timeoutSeconds--;
                    readline.moveCursor(process.stdout, 0, -3);
                    this.Logs.force(`If no input is detected for ${this.Logs.y}${timeoutSeconds}${this.Logs.reset} seconds, the default configuration will be used`, this.configLevel);
                    readline.moveCursor(process.stdout, 0, 3);
                }
            }, 1000);
            this.Logs.force('Create custom config?', this.configLevel);
            const startConfig = await this.Logs.select({ true: 'Yes', false: 'No' }, true);
            clearTimeout(timeOut);
            this.Logs.emit('cancelInput');
            if (!startConfig) {
                this.write(file);
                return;
            }
        } else {
            this.Logs.force('Create custom config?', this.configLevel);
            const startConfig = await this.Logs.select({ true: 'Yes', false: 'No' }, true);
            if (!startConfig) {
                this.write(file);
                return;
            }
        }

        this.Logs.force('Entering configuration', this.configLevel);
        this.Logs.force('', this.blankLevel);
        for (const key in this.required) {
            if (!Object.hasOwnProperty.call(this.required, key)) continue;
            const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
            if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met

            const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];

            this.Logs.force(`${question} (${this.Logs.y}${key}${this.Logs.reset})`, this.blankLevel); // Ask question
            let input;

            if (this.required[key] === 'INFO') {
                input = this.Logs.select({ true: 'Next' }, true);
            } else if (typeof this.required[key] !== 'undefined') { // If choices are specified print them
                if ((Array.isArray(this.required[key]) && this.required[key].length > 0) || Object.keys(this.required[key]).length > 0) {
                    input = this.Logs.select(this.required[key], this.get(key));
                } else {
                    [input] = this.Logs.input(this.get(key));
                }
            } else {
                [input] = this.Logs.input(this.get(key));
            }
            this.config[key] = await input;
            this.emit('set', {
                'property': key,
                'value': this.config[key]
            });
        }
        this.Logs.force('', this.blankLevel);
        this.print();
        this.write(file);
        this.Logs.force('', this.blankLevel);
        this.Logs.force('Finished configuration', this.configLevel);
    }

    //Create config from API queries
    async fromAPI(file = 'config.conf', requestFunction: (question: string, current: any, text?: string) => any, doneFunction: () => void) {
        this.Logs.force('Entering configuration', this.configLevel);
        this.Logs.force('', this.blankLevel);
        for (const key in this.required) {
            if (!Object.hasOwnProperty.call(this.required, key)) continue;
            const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
            if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met

            const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];

            this.Logs.force(`${question} (${this.Logs.y}${key}${this.Logs.reset})`, this.blankLevel); // Ask question
            let input;

            if (this.required[key] === 'INFO') {
                await requestFunction(question, true, 'INFO');
                continue;
            } else if (typeof this.required[key] !== 'undefined') { // If choices are specified print them
                if ((Array.isArray(this.required[key]) && this.required[key].length > 0) || Object.keys(this.required[key]).length > 0) {
                    input = requestFunction(question, this.get(key), this.required[key]);
                } else {
                    input = requestFunction(question, this.get(key));
                }
            } else {
                input = requestFunction(question, this.get(key));
            }
            this.config[key] = await input;
            this.emit('set', {
                'property': key,
                'value': this.config[key]
            });
        }
        this.Logs.force('', this.blankLevel);
        this.print();
        this.write(file);
        this.Logs.force('', this.blankLevel);
        this.Logs.force('Finished configuration', this.configLevel);
        doneFunction();
    }

    //Create config to file <file>
    write(file = 'config.conf') {
        if (!fs.existsSync(this.filePath)) {
            fs.mkdirSync(this.filePath, {
                recursive: true
            });
        }
        this.Logs.force(`Saving configuration to ${this.Logs.c}${path.join(this.filePath, file)}${this.Logs.reset}`, this.configLevel);
        fs.writeFileSync(path.join(this.filePath, file), JSON.stringify(this.all()));
    }

    //Create array of objects keys via <property> to data folder
    writeObject(property: string) {
        const filePath = path.join(this.filePath, '/data');
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, {
                recursive: true
            });
        }
        // this.logger.force('', this.BlankLevel);
        this.Logs.force(`Saving configuration to ${this.Logs.c}${filePath}/${property}.json${this.Logs.reset}`, this.configLevel);
        fs.writeFileSync(`${filePath}/${property}.json`, JSON.stringify(this.config[property], null, 4));
    }

    //Request user test input, run <callback> against input text
    userInput(callBack?: (input: string) => Promise<boolean>) {
        const [onInput, reader] = this.Logs.silentInput() as [Promise<string>, readline.Interface];

        onInput.then(async (input) => {
            this.Logs.pause();

            this.Logs.logSend({
                'time': `${this.Logs.c}Data Entered${this.Logs.reset}`,
                'level': 'U',
                'levelColour': this.Logs.c,
                'textColour': this.Logs.w,
                'levelText': '',
                'levelTextColour': this.Logs.c,
                'seperator': '|',
                'text': input,
                'lineNum': ''
            }, true);

            switch (input) {
                case 'exit':
                case 'quit':
                case 'q': {
                    this.doExitCheck();
                    break;
                }
                case '':
                    break;
                default:
                    if (typeof callBack == 'function') {
                        const valid = await callBack(input);
                        if (!valid) {
                            this.Logs.force('User entered invalid command, ignoring', this.blankLevel);
                        }
                    } else {
                        this.Logs.force('User entered invalid command, ignoring', this.blankLevel);
                    }
            }
            this.userInput(callBack);
            this.Logs.resume();
        });

        reader.on('SIGINT', () => {
            reader.close();
            reader.removeAllListeners();
            this.doExitCheck();
        });
    }

    //Ask use if they are sure they want to exit application in CLI
    doExitCheck() {
        this.Logs.pause();

        this.Logs.force('Are you sure you want to exit? (y, n)', [this.logerLevel, 'SERVER', this.Logs.r]);

        const [onInput, reader] = this.Logs.input('yes', this.Logs.r) as [Promise<any>, readline.Interface];
        onInput.then((input) => {
            if (input.match(/^y(es)?$/i) || input == '') {
                this.Logs.force('Process exited by user command', [this.logerLevel, 'SERVER', this.Logs.r]);
                process.exit();
            } else {
                this.Logs.force('Exit canceled', [this.logerLevel, 'SERVER' as LevelText, this.Logs.g]);
                this.Logs.resume();
                return this.userInput();
            }
        });

        reader.on('SIGINT', () => {
            reader.close();
            console.log();
            readline.moveCursor(process.stdout, 0, -1);
            readline.clearLine(process.stdout, 1);

            this.Logs.logSend({
                'time': `${this.Logs.c} User Input ${this.Logs.reset}`,
                'level': 'U',
                'levelColour': this.Logs.r,
                'levelText': '',
                'levelTextColour': this.Logs.r,
                'textColour': this.Logs.c,
                'seperator': '|',
                'text': 'yes',
                'lineNum': ''
            }, true);

            this.Logs.force('Process exited by user command', [this.logerLevel, 'SERVER', this.Logs.r]);
            process.exit();
        });
    }

    //Set config property
    set(property: string, value: any) {
        this.config[property] = typeof value === 'undefined' ? this.defaults[property] : value;
        if (Object.keys(this.objects).includes(property)) {
            this.#checkObject(property);
            this.writeObject(property);
        } else {
            this.write();
            this.emit('set', {
                'property': property,
                'value': value
            });
        }
    }

    //Get config property, if property is a config object array, only return entries whos specified filter field match <filterValue>
    get(property: string, filterValue?: any) {
        if (Object.keys(this.objects).includes(property)) {
            const objectDefinition = this.objects[property];
            const value = this.config[property] as Array<{ [key: string]: any }>
            if (filterValue !== undefined) return value.filter(item => item[objectDefinition.filter] == filterValue);
            else return value;
        } else {
            const value = typeof this.config[property] === 'undefined' ? this.defaults[property] : this.config[property];
            return value;
        }
    }

    //Return all config paramaters (excludes config objects)
    all() {
        const allConfig: { [key: string]: any } = {};
        for (const property in this.defaults) {
            if (Object.hasOwnProperty.call(this.defaults, property) && typeof this.defaults[property] !== 'function') {
                if (Object.keys(this.objects).includes(property)) continue;
                allConfig[property] = this.defaults[property];
            }
        }
        for (const property in this.config) {
            if (Object.hasOwnProperty.call(this.config, property) && typeof this.config[property] !== 'function') {
                if (Object.keys(this.objects).includes(property)) continue;
                allConfig[property] = this.get(property);
            }
        }
        return allConfig;
    }

    //Define the default value for <property>
    default(property: string, value: any) {
        this.defaults[property] = value;
    }

    //Mark <property> as required when using fromCLI or fromAPI
    //If set <values> is a list of options the property must be
    //If set <question> is the text that will be displayed by fromCLI or fromAPI when requesting the value
    //If set <dependancy> will only present this property when the dependant is set to the specified value
    require(property: string, values: any, question: string, dependancy?: (string | boolean)[]) {
        this.required[property] = values;
        if (typeof question !== 'undefined') this.questions[property] = question;
        if (typeof dependancy !== 'undefined') this.dependancies[property] = dependancy;
    }

    //When asking questions in fromAPI or fromCLI display the following as text with no option to set value
    info(property: string, question: string, dependancy?: string) {
        this.required[property] = 'INFO';
        if (typeof question !== 'undefined') this.questions[property] = question;
        if (typeof dependancy !== 'undefined') this.dependancies[property] = dependancy;
    }

    //Print the config to CLI
    //If set <printFunction> will be exectued against each config entry as well
    print(printFunction?: (text: string) => void) {
        const allConfig = this.all();
        for (const key in allConfig) {
            if (!Object.hasOwnProperty.call(allConfig, key)) continue;
            if (this.required[key] == 'INFO') continue;
            if (typeof printFunction !== 'undefined') {
                printFunction(`Configuration option ${this.Logs.y}${key}${this.Logs.reset} has been set to: ${this.Logs.c}${this.get(key)}${this.Logs.reset}`);
            }
            this.Logs.force(`Configuration option ${this.Logs.y}${key}${this.Logs.reset} has been set to: ${this.Logs.c}${this.get(key)}${this.Logs.reset}`, this.configLevel);
        }
    }

    //Set the array of objects definition for <definition.property> and define default values
    async object(definition: ObjectDefinition, defaults: { [key: string]: any }) {
        this.objects[definition.property] = definition;
        this.defaults[definition.property] = defaults;
        const filePath = path.join(this.filePath, '/data');

        if (!fs.existsSync(filePath)) {
            this.config[definition.property] = defaults;
            fs.mkdirSync(filePath, {
                recursive: true
            });
        } else {
            try {
                const configData = await fs.promises.readFile(path.join(filePath, `${definition.property}.json`));
                const fileObject = JSON.parse(configData.toString());
                this.config[definition.property] = fileObject;
            } catch (error) {
                this.config[definition.property] = defaults;
                this.Logs.warn(`There is an error with the config file at ${path.join(filePath, `${definition.property}.json`)}, loading defaults`);
                this.writeObject(definition.property);
            }
        }
    }

    #checkObject(property: string) {
        const values = this.config[property] as Array<{ [key: string]: any }>;
        const def = this.objects[property];
        values.forEach((value, index) => {
            for (const key in def.options) {
                if (!Object.prototype.hasOwnProperty.call(def.options, key)) continue;
                if (def.options[key].default === undefined) continue;
                if (value[key] !== undefined) continue;
                this.config[property][index][key] = def.options[key].default;
            }
        });
    }

    //Set the current log level
    logLevel(value: Level = 'H') {
        this.logerLevel = value;
    }


    //Combines, default, require and object into a single convenience function
    //If set <Values> is a list of options the property must be
    //If set <Question> is the text that will be displayed by fromCLI or fromAPI when requesting the value
    //If set <Depends> will only present this property when the dependant is set to the specified value
    //Set the array of objects definition for <definition.property> and define default values
    define(property: string, options: DefineOptionsNonObject | DefineOptionsObject) {
        if (options.Default) {
            this.default(property, options.Default)
        }
        if (options.Depends) {
            this.dependancies[property] = options.Depends;
        }
        if (options.Question) {
            this.questions[property] = options.Question;
            if (options.Values) {
                this.required[property] = options.Values;
            } else {
                this.required[property] = [];
            }
        }
        if (options.Values) {
            this.required[property] = options.Values;
        }
        if (options.Info) {
            this.required[property] = 'INFO';
        }
        if (options.ObjectDefinition) {
            if (options.Default && typeof options.Default !== 'string') {
                this.object(options.ObjectDefinition, options.Default)
            }
        }
    }
}

module.exports.Config = Config;

export type ObjectDefinition = {
    property: string,
    filter: string,
    name: string,
    options: { [key: string]: any }
}

type DefineOptions = {
    Depends?: string[] | { [key: string]: any; }
    Question?: string
    Values?: string[] | { [key: string]: any; }
    Info?: string
}

interface DefineOptionsNonObject extends DefineOptions {
    ObjectDefinition?: undefined
    Default?: string | number | boolean
}

interface DefineOptionsObject extends DefineOptions {
    ObjectDefinition: ObjectDefinition
    Default: { [key: string]: any; }
}