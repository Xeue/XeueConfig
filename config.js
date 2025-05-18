const fs = require('fs');
const {Logs} = require('xeue-logs');
const readline = require('readline');
const EventEmitter = require('events');
const process = require('node:process');
const path = require('path');

class Config extends EventEmitter {
	constructor(
		logger
	) {
		super();
		if (logger) {
			this.logger = logger;
		} else {
			this.logger = new Logs(
				false,
				'configLogging',
				'./configLogging',
				'D',
				false
			);
		}
		this.defaults = {};
		this.required = {};
		this.dependancies = {};
		this.questions = {};
		this.config = {};
		this.filePath;
		this.objects = {};
		this.logLevel = 'H';
	}

	path(filePath) {
		this.filePath = filePath;
	}

	async fromFile(file = 'config.conf') {
		if (!fs.existsSync(this.filePath)) {
			fs.mkdirSync(this.filePath, {
				recursive: true
			});
		}
		try {
			const configData = await fs.promises.readFile(path.join(this.filePath, file));
			const fileObject = JSON.parse(configData);
			for (const key in fileObject) {
				if (Object.hasOwnProperty.call(fileObject, key)) {
					this.config[key] = fileObject[key];
				}
			}
			return true;
		} catch (error) {
			this.logger.log('There is an error with the config file or it doesn\'t exist', 'W');
			this.logger.object('Message', error, 'W');
			return false;
		}
	}

	async fromCLI(file = 'config.conf', time = false) {
		console.log(process.stdout.isTTY);
		if (!process.stdout.isTTY) {
			this.write(file);
			return;
		}
		let timeOut;
		if (time) {
			this.logger.force(`If no input is detected for ${this.logger.y}${time}${this.logger.reset} seconds, the default configuration will be used`, [this.logLevel, 'CONFIG', this.logger.c]);
			const startTime = time;
			timeOut = setInterval(()=>{
				if (time < 1) {
					this.logger.force(`No input for ${this.logger.y}${startTime}${this.logger.reset} seconds, default config will be used`, [this.logLevel, 'CONFIG', this.logger.c]);
					this.logger.emit('cancelInput');
					clearTimeout(timeOut);
				} else {
					time--;
					readline.moveCursor(process.stdout, 0, -3);
					this.logger.force(`If no input is detected for ${this.logger.y}${time}${this.logger.reset} seconds, the default configuration will be used`, [this.logLevel, 'CONFIG', this.logger.c]);
					readline.moveCursor(process.stdout, 0, 3);
				}
			}, 1000);
		}
		this.logger.force('Create custom config?', [this.logLevel, 'CONFIG', this.logger.c]);
		const startConfig = await this.logger.select({true: 'Yes', false: 'No'}, true);
		clearTimeout(timeOut);
		this.logger.emit('cancelInput');
		if (!startConfig) {
			this.write(file);
			return;
		}

		this.logger.force('Entering configuration', [this.logLevel, 'CONFIG', this.logger.c]);
		this.logger.force('', [this.logLevel, '', this.logger.c]);
		for (const key in this.required) {
			if (!Object.hasOwnProperty.call(this.required, key)) continue;
			const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
			if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met
	
			const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];
	
			this.logger.force(`${question} (${this.logger.y}${key}${this.logger.reset})`, [this.logLevel, '', this.logger.c]); // Ask question
			let input;
	
			if (this.required[key] === 'INFO') {
				input = this.logger.select({true:'Next'}, true);
			} else if (typeof this.required[key] !== 'undefined') { // If choices are specified print them
				if ((Array.isArray(this.required[key]) && this.required[key].length > 0 ) || Object.keys(this.required[key]).length > 0) {
					input = this.logger.select(this.required[key], this.get(key));
				} else {
					[input] = this.logger.input(this.get(key));
				}
			} else {
				[input] = this.logger.input(this.get(key));
			}
			this.config[key] = await input;
			this.emit('set', {
				'property': key,
				'value': this.config[key]
			});
		}
		this.logger.force('', [this.logLevel, '', this.logger.c]);
		this.print();
		this.write(file);
		this.logger.force('', [this.logLevel, '', this.logger.c]);
		this.logger.force('Finished configuration', [this.logLevel, 'CONFIG', this.logger.c]);
	}

	async fromAPI(file = 'config.conf', requestFunction, doneFunction) {
		this.logger.force('Entering configuration', [this.logLevel, 'CONFIG', this.logger.c]);
		this.logger.force('', [this.logLevel, '', this.logger.c]);
		for (const key in this.required) {
			if (!Object.hasOwnProperty.call(this.required, key)) continue;
			const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
			if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met
	
			const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];
	
			this.logger.force(`${question} (${this.logger.y}${key}${this.logger.reset})`, [this.logLevel, '', this.logger.c]); // Ask question
			let input;
	
			if (this.required[key] === 'INFO') {
				await requestFunction(question, true, 'INFO');
				continue;
			} else if (typeof this.required[key] !== 'undefined') { // If choices are specified print them
				if ((Array.isArray(this.required[key]) && this.required[key].length > 0 ) || Object.keys(this.required[key]).length > 0) {
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
		this.logger.force('', [this.logLevel, '', this.logger.c]);
		this.print();
		this.write(file);
		this.logger.force('', [this.logLevel, '', this.logger.c]);
		this.logger.force('Finished configuration', [this.logLevel, 'CONFIG', this.logger.c]);
		doneFunction();
	}

	write(file = 'config.conf') {
		if (!fs.existsSync(this.filePath)) {
			fs.mkdirSync(this.filePath, {
				recursive: true
			});
		}
		this.logger.force(`Saving configuration to ${this.logger.c}${path.join(this.filePath, file)}${this.logger.reset}`, [this.logLevel, 'CONFIG', this.logger.c]);
		fs.writeFileSync(path.join(this.filePath, file), JSON.stringify(this.all()));
	}

	writeObject(property) {
		const filePath = path.join(this.filePath, '/data');
		if (!fs.existsSync(filePath)) {
			fs.mkdirSync(filePath, {
				recursive: true
			});
		}
		// this.logger.force('', [this.logLevel, '', this.logger.c]);
		this.logger.force(`Saving configuration to ${this.logger.c}${filePath}/${property}.json${this.logger.reset}`, [this.logLevel, 'CONFIG', this.logger.c]);
		fs.writeFileSync(`${filePath}/${property}.json`, JSON.stringify(this.config[property], null, 4));
	}

	userInput(callBack) {
		const [onInput, reader] = this.logger.silentInput();
	
		onInput.then(async (input) => {
			this.logger.pause();

			this.logger.logSend({
				'timeString': `${this.logger.c}Data Entered${this.logger.reset}`,
				'level': 'U',
				'colour': this.logger.c,
				'textColour': this.logger.w,
				'catagory': '',
				'seperator': '      |',
				'message': input,
				'lineNumString': ''
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
						this.logger.force('User entered invalid command, ignoring');
					}
				} else {
					this.logger.force('User entered invalid command, ignoring');
				}
			}
			this.userInput(callBack);
			this.logger.resume();
		});
	
		reader.on('SIGINT', () => {
			reader.close();
			reader.removeAllListeners();
			this.doExitCheck();
		});
	}

	doExitCheck() {
		this.logger.pause();
	
		this.logger.force('Are you sure you want to exit? (y, n)', [this.logLevel, '', this.logger.r]);
	
		const [onInput, reader] = this.logger.input('yes', this.logger.r);
		onInput.then((input)=>{
			if (input.match(/^y(es)?$/i) || input == '') {
				this.logger.force('Process exited by user command', [this.logLevel,'SERVER',this.logger.r]);
				process.exit();
			} else {
				this.logger.force('Exit canceled', [this.logLevel,'SERVER',this.logger.g]);
				this.logger.resume();
				return this.userInput();
			}
		});
	
		reader.on('SIGINT', () => {
			reader.close();
			console.log();
			readline.moveCursor(process.stdout, 0, -1);
			readline.clearLine(process.stdout, 1);

			this.logger.logSend({
				'timeString': `${this.logger.c} User Input ${this.logger.reset}`,
				'level': 'U',
				'colour': this.logger.r,
				'textColour': this.logger.c,
				'catagory': '',
				'seperator': '      |',
				'message': 'yes',
				'lineNumString': ''
			}, true);

			this.logger.force('Process exited by user command', [this.logLevel,'SERVER',this.logger.r]);
			process.exit();
		});
	}

	set(property, value) {
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

	get(property, filter) {
		const value = typeof this.config[property] === 'undefined' ? this.defaults[property] : this.config[property];
		if (Object.keys(this.objects).includes(property)) {
			const object = this.objects[property];
			if (filter !== undefined) return value.filter(item => item[object.filter] == filter);
			else return value;
		} else {
			return value;
		}
	}

	all() {
		const allConfig = {};
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

	default(property, value) {
		this.defaults[property] = value;
	}

	require(property, values, question, dependancy) {
		this.required[property] = values;
		if (typeof question !== 'undefined') this.questions[property] = question;
		if (typeof dependancy !== 'undefined') this.dependancies[property] = dependancy;
	}

	info(property, question, dependancy) {
		this.required[property] = 'INFO';
		if (typeof question !== 'undefined') this.questions[property] = question;
		if (typeof dependancy !== 'undefined') this.dependancies[property] = dependancy;
	}

	print(printFunction) {
		const allConfig = this.all();
		for (const key in allConfig) {
			if (!Object.hasOwnProperty.call(allConfig, key)) continue;
			if (this.required[key] == 'INFO') continue;
			if (typeof printFunction !== 'undefined') {
				printFunction(`Configuration option ${this.logger.y}${key}${this.logger.reset} has been set to: ${this.logger.c}${this.get(key)}${this.logger.reset}`);
			}
			this.logger.force(`Configuration option ${this.logger.y}${key}${this.logger.reset} has been set to: ${this.logger.c}${this.get(key)}${this.logger.reset}`, [this.logLevel, 'CONFIG', this.logger.c]);
		}
	}

	async object(definition, defaults) {
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
				const fileObject = JSON.parse(configData);
				this.config[definition.property] = fileObject;
			} catch (error) {
				this.config[definition.property] = defaults;
				this.logger.log(`There is an error with the config file at ${path.join(filePath, `${definition.property}.json`)}, loading defaults`, 'W');
				this.writeObject(definition.property);
			}
		}
	}

	#checkObject(property) {
		const values = this.config[property];
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

	logLevel(value = 'H') {
		this.logLevel = value;
	}
}

module.exports.Config = Config;