import fs from 'fs'
import {logs} from 'xeue-logs'
import readline from 'readline'
import process from 'node:process'

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
			logs.log('There is an error with the config file or it doesn\'t exist', 'W')
			logs.object('Message', error, 'W')
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
				logs.force(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.c}${config.get(key)}${logs.reset}`, ['H', 'CONFIG', logs.c])
			}
		}
	},

	useLogger: (logger) => {
		logs.use(logger)
	}
}

export default config

async function fromCLI(filePath = false) {
	logs.force('Entering configuration', ['H', 'CONFIG', logs.c])
	logs.force('', ['H', '', logs.c])
	for (const key in required) {
		if (Object.hasOwnProperty.call(required, key)) {
			const [dependant, value] = typeof dependacies[key] === 'undefined' ? [undefined, undefined] : dependacies[key]
			if (typeof dependant === 'undefined' || config.get(dependant) == value) { // If question has no dependancies or the dependancies are already met
				const question = typeof questions[key] === 'undefined' ? 'Please enter a value for' : questions[key]
				logs.force(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c]) // Ask question
				if (typeof required[key] !== 'undefined') { // If choices are specified print them
					if (required[key].length > 0 ) {
						logs.force(`${logs.dim}(${required[key].join(', ')})${logs.reset}`, ['H', '', logs.c])
					}
				}

				const [onInput] = logs.input(config.get(key))
				let input = await onInput
				if (typeof required[key] !== 'undefined') {
					if (required[key].length > 0 ) {
						while (!required[key].includes(input)) {
							logs.force(`Invalid value for ${logs.y}${key}${logs.reset} entered, valid values are: ${logs.dim}(${required[key].join(', ')})${logs.reset}`, ['H', '', logs.c])
							const [onInput] = logs.input()
							input = await onInput
						}
					}
				}
				config[key] = input
			}
		}
	}
	logs.force('', ['H', '', logs.c])
	config.print()
	if (filePath) {
		logs.force('', ['H', '', logs.c])
		logs.force(`Saving configuration to ${logs.c}${filePath}${logs.reset}`, ['H', 'CONFIG', logs.c])
		fs.writeFileSync(filePath, JSON.stringify(config.all()))
	}
	logs.force('', ['H', '', logs.c])
	logs.force('Finished configuration', ['H', 'CONFIG', logs.c])
}

function userInput(callBack) {

	const [onInput, reader] = logs.silentInput()

	onInput.then(async (input) => {
		logs.pause()
		console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ]       ${logs.c}| ${input}${logs.reset}`)

		switch (input) {
		case 'exit':
		case 'quit':
		case 'q': {
			doExitCheck()
			break
		}
		default:
			if (typeof callBack == 'function') {
				const valid = await callBack(input)
				if (!valid) {
					logs.force('User entered invalid command, ignoring')
				}
			} else {
				logs.force('User entered invalid command, ignoring')
			}
		}
		userInput(callBack)
		logs.resume()
	})

	reader.on('SIGINT', () => {
		reader.close()
		reader.removeAllListeners()
		doExitCheck()
	})
}

function doExitCheck() {
	logs.pause()

	logs.force('Are you sure you want to exit? (y, n)', ['H', '', logs.r])

	const [onInput, reader] = logs.input('yes', logs.r)
	onInput.then((input)=>{
		if (input.match(/^y(es)?$/i) || input == '') {
			logs.force('Exiting', ['H','SERVER',logs.r])
			process.exit()
		} else {
			logs.force('Exit canceled', ['H','SERVER',logs.g])
			logs.resume()
			return userInput()
		}
	})

	reader.on('SIGINT', () => {
		reader.close()
		console.log()
		readline.moveCursor(process.stdout, 0, -1)
		readline.clearLine(process.stdout, 1)
		console.log(`${logs.reset}[ ${logs.c}User Input${logs.w} ] ${logs.r}      |${logs.reset} ${logs.c}yes${logs.reset}`)
		logs.force('Exiting', ['H','SERVER',logs.r])
		process.exit()
	})
}