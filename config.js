import fs from 'fs'
import {log, logObj, logs} from 'xeue-logs'
import reader from 'readline-sync'


const defaults = {}
const required = {}
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
			log('There is an error with the config file or it doesn\'t exist', 'E')
			logObj('Message', error, 'E')
			return false
		}
	},

	fromCLI: (filePath = false) => {
		log(`Entering configuration 
		`, ['H', 'CONFIG', logs.c])
		for (const key in required) {
			if (Object.hasOwnProperty.call(required, key)) {
				const question = typeof questions[key] === 'undefined' ? 'Please enter a value for' : questions[key]
				log(`${question} (${logs.y}${key}${logs.reset})`, ['H', '', logs.c])
				if (typeof required[key] !== 'undefined') {
					if (required[key].length > 0 ) {
						log(`${logs.dim}(${required[key].join(', ')})${logs.reset}`, ['H', '', logs.c])
					}
				}
				config[key] = reader.question(`${logs.reset}[ User Input ] ${logs.c}      :${logs.reset} ${logs.g}`)
				if (typeof required[key] !== 'undefined') {
					if (required[key].length > 0 ) {
						while (!required[key].includes(config[key])) {
							log(`Invalid value for ${logs.y}${key}${logs.reset} entered, valid values are: ${logs.dim}(${required[key].join(', ')})${logs.reset}`, ['H', '', logs.c])
							config[key] = reader.question(`${logs.reset}[ User Input ] ${logs.c}      :${logs.reset} ${logs.g}`)
						}
					}
				}
			}
		}
		if (filePath) {
			log(`
Saving configuration to ${filePath}`, ['H', '', logs.c])
			fs.writeFileSync(filePath, JSON.stringify(config.all()))
		}
		log(`
Finished configuration`, ['H', '', logs.c])
	},

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

	require: (property, values, question) => {
		required[property] = values
		if (typeof question !== 'undefined') questions[property] = question
	},

	print: () => {
		for (const key in config.all()) {
			if (Object.hasOwnProperty.call(config.all(), key)) {
				log(`Configuration option ${logs.y}${key}${logs.reset} has been set to: ${logs.b}${config.get(key)}${logs.reset}`, ['H', 'CONFIG', logs.c])
			}
		}
	}
}

export default config