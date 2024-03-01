const fs = require('fs');
const {Logs} = require('xeue-logs');
const readline = require('readline');
const process = require('node:process');

class Config {
	constructor(
		logger
	) {
		if (logger) {
			this.logger = logger;
		} else {
			this.logger = new Logs(
				false,
				'configLogging',
				path.join(__data, 'configLogging'),
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
	}

	async fromFile(filePath) {
		this.filePath = filePath;
		let path = filePath.replace(/\\/g, '/').split('/');
		path.pop();
		path = path.join('/');
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, {
				recursive: true
			});
		}
		try {
			const configData = await fs.promises.readFile(filePath);
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

	async fromCLI(filePath = false, time = false) {
		console.log(process.stdout.isTTY);
		if (!process.stdout.isTTY) {
			this.write(filePath);
			return;
		}
		let timeOut;
		if (time) {
			this.logger.force(`If no input is detected for ${this.logger.y}${time}${this.logger.reset} seconds, the default configuration will be used`, ['H', 'CONFIG', this.logger.c]);
			const startTime = time;
			timeOut = setInterval(()=>{
				if (time < 1) {
					this.logger.force(`No input for ${this.logger.y}${startTime}${this.logger.reset} seconds, default config will be used`, ['H', 'CONFIG', this.logger.c]);
					this.logger.emit('cancelInput');
					clearTimeout(timeOut);
				} else {
					time--;
					readline.moveCursor(process.stdout, 0, -3);
					this.logger.force(`If no input is detected for ${this.logger.y}${time}${this.logger.reset} seconds, the default configuration will be used`, ['H', 'CONFIG', this.logger.c]);
					readline.moveCursor(process.stdout, 0, 3);
				}
			}, 1000);
		}
		this.logger.force('Create custom config?', ['H', 'CONFIG', this.logger.c]);
		const startConfig = await this.logger.select({true: 'Yes', false: 'No'}, true);
		clearTimeout(timeOut);
		if (!startConfig) {
			this.write(filePath);
			return;
		}

		this.logger.force('Entering configuration', ['H', 'CONFIG', this.logger.c]);
		this.logger.force('', ['H', '', this.logger.c]);
		for (const key in this.required) {
			if (!Object.hasOwnProperty.call(this.required, key)) continue;
			const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
			if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met
	
			const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];
	
			this.logger.force(`${question} (${this.logger.y}${key}${this.logger.reset})`, ['H', '', this.logger.c]); // Ask question
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
		}
		this.logger.force('', ['H', '', this.logger.c]);
		this.print();
		this.write(filePath);
		this.logger.force('', ['H', '', this.logger.c]);
		this.logger.force('Finished configuration', ['H', 'CONFIG', this.logger.c]);
	}

	async fromAPI(filePath = false, requestFunction, doneFunction) {
		this.logger.force('Entering configuration', ['H', 'CONFIG', this.logger.c]);
		this.logger.force('', ['H', '', this.logger.c]);
		for (const key in this.required) {
			if (!Object.hasOwnProperty.call(this.required, key)) continue;
			const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
			if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met
	
			const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];
	
			this.logger.force(`${question} (${this.logger.y}${key}${this.logger.reset})`, ['H', '', this.logger.c]); // Ask question
			let input;
	
			if (this.required[key] === 'INFO') {
				await requestFunction(question, true, 'INFO');
				continue;
			} else if (typeof this.required[key] !== 'undefined') { // If choices are specified print them
				if ((Array.isArray(this.required[key]) && this.required[key].length > 0 ) || Object.keys(this.required[key]).length > 0) {
					input = requestFunction(question, this.get(key), this.required[key])
				} else {
					input = requestFunction(question, this.get(key))
				}
			} else {
				input = requestFunction(question, this.get(key))
			}
			this.config[key] = await input;
		}
		this.logger.force('', ['H', '', this.logger.c]);
		this.print();
		this.write(filePath);
		this.logger.force('', ['H', '', this.logger.c]);
		this.logger.force('Finished configuration', ['H', 'CONFIG', this.logger.c]);
		doneFunction();
	}

	write(filePath) {
		if (!filePath) return;
		this.filePath = filePath;
		let path = filePath.replace(/\\/g, '/').split('/');
		path.pop();
		path = path.join('/');
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, {
				recursive: true
			});
		}
		this.logger.force('', ['H', '', this.logger.c]);
		this.logger.force(`Saving configuration to ${this.logger.c}${filePath}${this.logger.reset}`, ['H', 'CONFIG', this.logger.c]);
		fs.writeFileSync(filePath, JSON.stringify(this.all()));
	}

	userInput(callBack) {
		const [onInput, reader] = this.logger.silentInput();
	
		onInput.then(async (input) => {
			this.logger.pause();
			console.log(`${this.logger.reset}[${this.logger.c}Data Entered${this.logger.w}]       ${this.logger.c}| ${input}${this.logger.reset}`);
	
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
	
		this.logger.force('Are you sure you want to exit? (y, n)', ['H', '', this.logger.r]);
	
		const [onInput, reader] = this.logger.input('yes', this.logger.r);
		onInput.then((input)=>{
			if (input.match(/^y(es)?$/i) || input == '') {
				this.logger.force('Process exited by user command', ['H','SERVER',this.logger.r]);
				process.exit();
			} else {
				this.logger.force('Exit canceled', ['H','SERVER',this.logger.g]);
				this.logger.resume();
				return this.userInput();
			}
		});
	
		reader.on('SIGINT', () => {
			reader.close();
			console.log();
			readline.moveCursor(process.stdout, 0, -1);
			readline.clearLine(process.stdout, 1);
			console.log(`${this.logger.reset}[ ${this.logger.c}User Input${this.logger.w} ] ${this.logger.r}      |${this.logger.reset} ${this.logger.c}yes${this.logger.reset}`);
			this.logger.force('Process exited by user command', ['H','SERVER',this.logger.r]);
			process.exit();
		});
	}

	set(property, value) {
		this.config[property] = typeof value === 'undefined' ? this.defaults[property] : value;
		this.write(this.filePath);
	}

	get(property) {
		return typeof this.config[property] === 'undefined' ? this.defaults[property] : this.config[property];
	}

	all() {
		const allConfig = {};
		for (const key in this.defaults) {
			if (Object.hasOwnProperty.call(this.defaults, key) && typeof this.defaults[key] !== 'function') {
				allConfig[key] = this.defaults[key];
			}
		}
		for (const key in this.config) {
			if (Object.hasOwnProperty.call(this.config, key) && typeof this.config[key] !== 'function') {
				allConfig[key] = this.get(key);
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
			this.logger.force(`Configuration option ${this.logger.y}${key}${this.logger.reset} has been set to: ${this.logger.c}${this.get(key)}${this.logger.reset}`, ['H', 'CONFIG', this.logger.c]);
		}
	}
}

module.exports.Config = Config;