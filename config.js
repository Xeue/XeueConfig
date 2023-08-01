const fs = require('fs');
const {logs} = require('xeue-logs');
const readline = require('readline');
const process = require('node:process');

const defaults = {};
const required = {};
const dependancies = {};
const questions = {};

const config = {
	fromFile: async filePath => {
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
					config[key] = fileObject[key];
				}
			}
			return true;
		} catch (error) {
			logs.log('There is an error with the config file or it doesn\'t exist', 'W');
			logs.object('Message', error, 'W');
			return false;
		}
	},

	fromCLI: fromCLI,

	fromAPI: fromAPI,

	userInput: userInput,

	set: (property, value) => {
		config[property] = typeof value === 'undefined' ? defaults[property] : value;
	},

	get: property => {
		return typeof config[property] === 'undefined' ? defaults[property] : config[property];
	},

	all: () => {
		const allConfig = {};
		for (const key in defaults) {
			if (Object.hasOwnProperty.call(defaults, key) && typeof defaults[key] !== 'function') {
				allConfig[key] = defaults[key];
			}
		}
		for (const key in config) {
			if (Object.hasOwnProperty.call(config, key) && typeof config[key] !== 'function') {
				allConfig[key] = config.get(key);
			}
		}
		return allConfig;
	},

	default: (property, value) => {
		defaults[property] = value;
	},

	require: (property, values, question, dependancy) => {
		required[property] = values;
		if (typeof question !== 'undefined') questions[property] = question;
		if (typeof dependancy !== 'undefined') dependancies[property] = dependancy;
	},

	info: (property, question, dependancy) => {
		required[property] = 'INFO';
		if (typeof question !== 'undefined') questions[property] = question;
		if (typeof dependancy !== 'undefined') dependancies[property] = dependancy;
	},

	print: (printFunction) => {
		for (const key in config.all()) {
			if (!Object.hasOwnProperty.call(config.all(), key)) continue;
			if (required[key] == 'INFO') continue;
			if (typeof printFunction !== 'undefined') {
				printFunction(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.c}${config.get(key)}${logs.reset}`);
			}
			logs.force(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.c}${config.get(key)}${logs.reset}`, ['H', 'CONFIG', logs.c]);
		}
	},

	useLogger: (logger) => {
		logs.use(logger);
	}
};

async function fromCLI(filePath = false) {
	logs.force('Entering configuration', ['H', 'CONFIG', logs.c]);
	logs.force('', ['H', '', logs.c]);
	for (const key in required) {
		if (!Object.hasOwnProperty.call(required, key)) continue;
		const [dependant, value] = typeof dependancies[key] === 'undefined' ? [undefined, undefined] : dependancies[key];
		if (dependant !== undefined && config.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met

		const question = typeof questions[key] === 'undefined' ? 'Please enter a value for' : questions[key];

		logs.force(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c]); // Ask question
		let input;

		if (required[key] === 'INFO') {
			input = logs.select({true:'Next'}, true);
		} else if (typeof required[key] !== 'undefined') { // If choices are specified print them
			if ((Array.isArray(required[key]) && required[key].length > 0 ) || Object.keys(required[key]).length > 0) {
				input = logs.select(required[key], config.get(key));
			} else {
				[input] = logs.input(config.get(key));
			}
		} else {
			[input] = logs.input(config.get(key));
		}
		config[key] = await input;
	}
	logs.force('', ['H', '', logs.c]);
	config.print();
	if (filePath) {
		let path = filePath.replace(/\\/g, '/').split('/');
		path.pop();
		path = path.join('/');
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, {
				recursive: true
			});
		}
		logs.force('', ['H', '', logs.c]);
		logs.force(`Saving configuration to ${logs.c}${filePath}${logs.reset}`, ['H', 'CONFIG', logs.c]);
		fs.writeFileSync(filePath, JSON.stringify(config.all()));
	}
	logs.force('', ['H', '', logs.c]);
	logs.force('Finished configuration', ['H', 'CONFIG', logs.c]);
}

async function fromAPI(filePath = false, requestFunction, doneFunction) {
	logs.force('Entering configuration', ['H', 'CONFIG', logs.c]);
	logs.force('', ['H', '', logs.c]);
	for (const key in required) {
		if (!Object.hasOwnProperty.call(required, key)) continue;
		const [dependant, value] = typeof dependancies[key] === 'undefined' ? [undefined, undefined] : dependancies[key];
		if (dependant !== undefined && config.get(dependant) !== value) continue; // If question has no dependancies or the dependancies are already met

		const question = typeof questions[key] === 'undefined' ? 'Please enter a value for' : questions[key];

		logs.force(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c]); // Ask question
		let input;

		if (required[key] === 'INFO') {
			await requestFunction(question, true, 'INFO');
			continue;
		} else if (typeof required[key] !== 'undefined') { // If choices are specified print them
			if ((Array.isArray(required[key]) && required[key].length > 0 ) || Object.keys(required[key]).length > 0) {
				input = requestFunction(question, config.get(key), required[key])
			} else {
				input = requestFunction(question, config.get(key))
			}
		} else {
			input = requestFunction(question, config.get(key))
		}
		config[key] = await input;
	}
	logs.force('', ['H', '', logs.c]);
	config.print();
	if (filePath) {
		let path = filePath.replace(/\\/g, '/').split('/');
		path.pop();
		path = path.join('/');
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, {
				recursive: true
			});
		}
		logs.force('', ['H', '', logs.c]);
		logs.force(`Saving configuration to ${logs.c}${filePath}${logs.reset}`, ['H', 'CONFIG', logs.c]);
		fs.writeFileSync(filePath, JSON.stringify(config.all()));
	}
	logs.force('', ['H', '', logs.c]);
	logs.force('Finished configuration', ['H', 'CONFIG', logs.c]);
	doneFunction();
}

function userInput(callBack) {

	const [onInput, reader] = logs.silentInput();

	onInput.then(async (input) => {
		logs.pause();
		console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ]       ${logs.c}| ${input}${logs.reset}`);

		switch (input) {
		case 'exit':
		case 'quit':
		case 'q': {
			doExitCheck();
			break;
		}
		case '':
			break;
		default:
			if (typeof callBack == 'function') {
				const valid = await callBack(input);
				if (!valid) {
					logs.force('User entered invalid command, ignoring');
				}
			} else {
				logs.force('User entered invalid command, ignoring');
			}
		}
		userInput(callBack);
		logs.resume();
	});

	reader.on('SIGINT', () => {
		reader.close();
		reader.removeAllListeners();
		doExitCheck();
	});
}

function doExitCheck() {
	logs.pause();

	logs.force('Are you sure you want to exit? (y, n)', ['H', '', logs.r]);

	const [onInput, reader] = logs.input('yes', logs.r);
	onInput.then((input)=>{
		if (input.match(/^y(es)?$/i) || input == '') {
			logs.force('Exiting', ['H','SERVER',logs.r]);
			process.exit();
		} else {
			logs.force('Exit canceled', ['H','SERVER',logs.g]);
			logs.resume();
			return userInput();
		}
	});

	reader.on('SIGINT', () => {
		reader.close();
		console.log();
		readline.moveCursor(process.stdout, 0, -1);
		readline.clearLine(process.stdout, 1);
		console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.r}      |${logs.reset} ${logs.c}yes${logs.reset}`);
		logs.force('Exiting', ['H','SERVER',logs.r]);
		process.exit();
	});
}

exports.config = config;