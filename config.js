import fs from 'fs'
import {log, logObj, logs} from 'xeue-logs'
import readline from 'readline'

const defaults = {}
const required = {}
const dependacies = {}
const questions = {}

const config = {
	fromFile: async path => {
		try {
			const configData = await fs.promises.readFile(path)
			const fileObject = JSON.parse(configData)
			for (const key in fileObject) {
				if (Object.hasOwnProperty.call(fileObject, key)) {
					config[key] = fileObject[key]
				}
			}
			return true
		} catch (error) {
			log('There is an error with the config file or it doesn\'t exist', 'W')
			logObj('Message', error, 'W')
			return false
		}
	},

	fromCLI: fromCLI,

	userInput: userInput,

	set: (property, value) => {
		config[property] = typeof value === 'undefined' ? defaults[property] : value
	},

	get: property => {
		return typeof config[property] === 'undefined' ? defaults[property] : config[property]
	},

	all: () => {
		const allConfig = {}
		for (const key in defaults) {
			if (Object.hasOwnProperty.call(defaults, key) && typeof defaults[key] !== 'function') {
				allConfig[key] = defaults[key]
			}
		}
		for (const key in config) {
			if (Object.hasOwnProperty.call(config, key) && typeof config[key] !== 'function') {
				allConfig[key] = config.get(key)
			}
		}
		return allConfig
	},

	default: (property, value) => {
		defaults[property] = value
	},

	require: (property, values, question, dependacy) => {
		required[property] = values
		if (typeof question !== 'undefined') questions[property] = question
		if (typeof dependacy !== 'undefined') dependacies[property] = dependacy
	},

	print: () => {
		for (const key in config.all()) {
			if (Object.hasOwnProperty.call(config.all(), key)) {
				log(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.c}${config.get(key)}${logs.reset}`, ['H', 'CONFIG', logs.c])
			}
		}
	}
}

export default config

async function fromCLI(filePath = false) {
	logs.force(`Entering configuration`, ['H', 'CONFIG', logs.c])
	logs.force(``, ['H', '', logs.c])
	for (const key in required) {
		if (Object.hasOwnProperty.call(required, key)) {
			const [dependant, value] = typeof dependacies[key] === 'undefined' ? [undefined, undefined] : dependacies[key]
			if (typeof dependant === 'undefined' || config.get(dependant) == value) {
				const question = typeof questions[key] === 'undefined' ? 'Please enter a value for' : questions[key]
				logs.force(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c])
				if (typeof required[key] !== 'undefined') {
					if (required[key].length > 0 ) {
						logs.force(`${logs.dim}(${required[key].join(', ')})${logs.reset}`, ['H', '', logs.c])
					}
				}
				config[key] = await askQuestion(key)
			}
		}
	}
	if (filePath) {
		logs.force(``, ['H', '', logs.c])
		logs.force(`Saving configuration to ${logs.c}${filePath}${logs.reset}`, ['H', '', logs.c])
		fs.writeFileSync(filePath, JSON.stringify(config.all()))
	}
	logs.force(``, ['H', '', logs.c])
	logs.force(`Finished configuration`, ['H', 'CONFIG', logs.c])
}

function askQuestion(key) {
	const configReader = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: `${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.c}      | `
	})
	let output
	return new Promise ((resolve) => {
		console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.c}      |${logs.reset} ${logs.dim}${defaults[key]}${logs.reset}${logs.c}`)
		readline.moveCursor(process.stdout, 0, -1)
		readline.moveCursor(process.stdout, 23, 0)
		configReader.on('line', async (input)=>{
			configReader.close();
			if (input == 'false') input = false
			if (input == 'true') input = true
			if (input == '') input = defaults[key]
			output = input
			if (typeof required[key] !== 'undefined') {
				if (required[key].length > 0 ) {
					while (!required[key].includes(output)) {
						logs.force(`Invalid value for ${logs.y}${key}${logs.reset} entered, valid values are: ${logs.dim}(${required[key].join(', ')})${logs.reset}`, ['H', '', logs.c])
						let input = await retryQuestion()
						if (input == 'false') input = false
						if (input == 'true') input = true
						output = input
					}
				}
			}
			resolve(output)
		})
	})
}

function retryQuestion() {
	const retryReader = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: `${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.c}      | `
	})
	return new Promise ((resolve) => {
		retryReader.question(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.c}      |${logs.reset} ${logs.c}`, (output) => {
			retryReader.close()
			resolve(output)
		})
	})
}

function userInput(callBack) {
	const reader = readline.createInterface(process.stdin, process.stdout)
	reader.on('line', async function (command) {
		reader.close()
		readline.moveCursor(process.stdout, 0, -1)
		readline.clearLine(process.stdout, 1)
		console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.w}  USER:${logs.reset} ${logs.c}${command}`)
		logs.pause()

		switch (command) {
		case 'exit':
		case 'quit':
		case 'q': {
			doExitCheck()
			break
		}
		default:
			if (typeof callBack == 'function') {
				const valid = await callBack(command)
				if (!valid) {
					logs.force('User entered invalid command, ignoring')
				}
			} else {
				logs.force('User entered invalid command, ignoring')
			}
		}
		logs.resume()
		userInput(callBack)
	})
	
	reader.on('SIGINT', () => {
		reader.close()
		reader.removeAllListeners()
		doExitCheck()
	})
	return reader
}

function doExitCheck() {
	logs.pause()
	const exitReader = readline.createInterface(process.stdin, process.stdout)
	logs.force('Are you sure you want to exit? (y, n)', ['H', '', logs.r])
	exitReader.on('SIGINT', () => {
		exitReader.close()
		console.log()
		logs.force('Exiting', ['H','',logs.r])
		process.exit()
	})
	exitReader.question(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.r}      |${logs.reset} ${logs.c}`, (input) => {
		exitReader.close()
		if (input == '') {
			readline.moveCursor(process.stdout, 0, -1)
			readline.clearLine(process.stdout, 1)
			console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.r}      |${logs.reset} ${logs.dim}NaN${logs.reset}`)
		}
		if (input.match(/^y(es)?$/i) || input == '') {
			logs.force('Exiting', ['H','',logs.r])
			process.exit()
		} else {
			logs.force('Exit canceled', ['H','',logs.g])
			logs.resume();
			return userInput()
		}
	})
}