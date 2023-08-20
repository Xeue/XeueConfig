const fs = require('fs');
const {logs} = require('xeue-logs');
const readline = require('readline');
const process = require('node:process');

class Config {
	constructor(
		logger = logs
	) {
		this.logger = logger;
		this.defaults = {};
		this.required = {};
		this.dependancies = {};
		this.questions = {};
		this.config = {};
	}

	async fromFile(filePath) {
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

	async fromCLI(filePath = false) {
		this.logger.force('Entering configuration', ['H', 'CONFIG', logs.c]);
		this.logger.force('', ['H', '', logs.c]);
		for (const key in this.required) {
			if (!Object.hasOwnProperty.call(this.required, key)) continue;
			const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
			if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met
	
			const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];
	
			this.logger.force(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c]); // Ask question
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
		this.logger.force('', ['H', '', logs.c]);
		this.print();
		if (filePath) {
			let path = filePath.replace(/\\/g, '/').split('/');
			path.pop();
			path = path.join('/');
			if (!fs.existsSync(path)) {
				fs.mkdirSync(path, {
					recursive: true
				});
			}
			this.logger.force('', ['H', '', logs.c]);
			this.logger.force(`Saving configuration to ${logs.c}${filePath}${logs.reset}`, ['H', 'CONFIG', logs.c]);
			fs.writeFileSync(filePath, JSON.stringify(this.all()));
		}
		this.logger.force('', ['H', '', logs.c]);
		this.logger.force('Finished configuration', ['H', 'CONFIG', logs.c]);
	}

	async fromAPI(filePath = false, requestFunction, doneFunction) {
		this.logger.force('Entering configuration', ['H', 'CONFIG', logs.c]);
		this.logger.force('', ['H', '', logs.c]);
		for (const key in this.required) {
			if (!Object.hasOwnProperty.call(this.required, key)) continue;
			const [dependant, value] = typeof this.dependancies[key] === 'undefined' ? [undefined, undefined] : this.dependancies[key];
			if (dependant !== undefined && this.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met
	
			const question = typeof this.questions[key] === 'undefined' ? 'Please enter a value for' : this.questions[key];
	
			this.logger.force(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c]); // Ask question
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
		this.logger.force('', ['H', '', logs.c]);
		this.print();
		if (filePath) {
			let path = filePath.replace(/\\/g, '/').split('/');
			path.pop();
			path = path.join('/');
			if (!fs.existsSync(path)) {
				fs.mkdirSync(path, {
					recursive: true
				});
			}
			this.logger.force('', ['H', '', logs.c]);
			this.logger.force(`Saving configuration to ${logs.c}${filePath}${logs.reset}`, ['H', 'CONFIG', logs.c]);
			fs.writeFileSync(filePath, JSON.stringify(this.all()));
		}
		this.logger.force('', ['H', '', logs.c]);
		this.logger.force('Finished configuration', ['H', 'CONFIG', logs.c]);
		doneFunction();
	}

	userInput(callBack) {
		const [onInput, reader] = this.logger.silentInput();
	
		onInput.then(async (input) => {
			this.logger.pause();
			console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ]       ${logs.c}| ${input}${logs.reset}`);
	
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
			userInput(callBack);
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
	
		this.logger.force('Are you sure you want to exit? (y, n)', ['H', '', logs.r]);
	
		const [onInput, reader] = this.logger.input('yes', logs.r);
		onInput.then((input)=>{
			if (input.match(/^y(es)?$/i) || input == '') {
				this.logger.force('Exiting', ['H','SERVER',logs.r]);
				process.exit();
			} else {
				this.logger.force('Exit canceled', ['H','SERVER',logs.g]);
				this.logger.resume();
				return userInput();
			}
		});
	
		reader.on('SIGINT', () => {
			reader.close();
			console.log();
			readline.moveCursor(process.stdout, 0, -1);
			readline.clearLine(process.stdout, 1);
			console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.r}      |${logs.reset} ${logs.c}yes${logs.reset}`);
			this.logger.force('Exiting', ['H','SERVER',logs.r]);
			process.exit();
		});
	}

	set(property, value) {
		this.config[property] = typeof value === 'undefined' ? this.defaults[property] : value;
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
				printFunction(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.c}${this.get(key)}${logs.reset}`);
			}
			this.logger.force(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.c}${this.get(key)}${logs.reset}`, ['H', 'CONFIG', logs.c]);
		}
	}
};

module.exports.Config = Config;