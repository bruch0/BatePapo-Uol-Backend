import express from 'express';
import cors from 'cors'
import fs from 'fs'
import dayjs from 'dayjs'
import { stripHtml } from "string-strip-html";
import Joi from 'joi';

const app = express();
app.use(cors());
app.use(express.json());

let participants = [];
let messages = [];

fs.readFile('./participants.json', 'utf8' , (err, data) => {
	participants = JSON.parse(data);
});

fs.readFile('./messages.json', 'utf8' , (err, data) => {
	messages = JSON.parse(data);
});

app.post('/participants', (req, res) => {
	const neededParams = Joi.object({
		name: Joi.string()
			.min(1)
			.required(),
		}
	)

	const checkUserAvailable = (user) => {
		const userAlreadyInUse = participants.find((participant) => participant.name === user.name)
		const joiValidation = neededParams.validate(user);
		return (!joiValidation.error && !userAlreadyInUse)
	}

	const newParticipant = req.body;
	newParticipant.name !== undefined ? newParticipant.name = stripHtml(newParticipant.name).result : '';
	
	if (checkUserAvailable(newParticipant)) {
		const time = Date.now()

		participants.push({...req.body, lastStatus: time});

		messages.push(
			{
				from: req.body.name.trim(),
				to: 'Todos',
				text: 'entra na sala...',
				type: 'status',
				time: dayjs(time).format('HH:mm:ss')
			}
		)

		fs.writeFileSync('./participants.json', JSON.stringify(participants), 'utf-8');
		fs.writeFileSync('./messages.json', JSON.stringify(messages), 'utf-8');

		res.status(200).send('Sucesso!');
	}
	else {
		res.status(400).send();
	}
});

app.get('/participants', (req, res) => {
	res.status(200).send(participants)
});

app.post('/messages', (req, res) => {
	const neededParams = Joi.object({
		from: Joi.string()
			.required(),
		to: Joi.string()
			.min(1)
			.required(),

		text: Joi.string()
			.min(1)
			.required(),
		
		type: Joi.string()
			.min(1)
			.valid('message','private_message')
			.required(),
		time: Joi.string()
			.required()
		}
	)

	const validateRequisition = (object) => {
		const userIsLogged = participants.find((participant) => participant.name === object.from);
		const joiValidation = neededParams.validate(object);
		console.log(joiValidation);

		return (!joiValidation.error && userIsLogged)
	}
	
	const time = Date.now()
	const from = req.get('User');
	
	const message = {
		from: from.trim(),
		to: req.body.to.trim(),
		text: req.body.text.trim(),
		type: req.body.type.trim(),
		time: dayjs(time).format('HH:mm:ss')
	}
	
	if (validateRequisition(message)) {
		messages.push(message);
		fs.writeFileSync('./messages.json', JSON.stringify(messages), 'utf-8');
		res.status(200).send('valeu');
	}
	else {
		res.status(400).send();
	}
});


app.get('/messages', (req, res) => {
	const iCanRead = (message, user) => {
		return message.from === user || message.to === user || message.type === 'message' || message.type === 'status'
	}

	const limit = Number(req.query.limit);
	const user = req.get('User');

	const messagesToUser = messages.filter((message) => iCanRead(message, user));
	
	limit ? 
	res.status(200).send(messagesToUser.splice(messagesToUser.length - limit, limit))
	: 
	res.status(200).send(messagesToUser);
});

app.post('/status', (req, res) => {
	const user = req.get('User');
	const userIsLogged = participants.find((participant) => participant.name === user);
	(!userIsLogged ? res.status(400).send() : userIsLogged.lastStatus = Date.now());
	res.status(200).send()
});

const removeAfkUsers = () => {
	const newParticipantList = [];
	const time = Date.now();
	participants.forEach((participant) => {
		if ((time - participant.lastStatus) / 1000 > 10) {
			messages.push(
				{
					from: participant.name,
					to: 'Todos',
					text: 'sai da sala...',
					type: 'status',
					time: dayjs(time).format('HH:mm:ss')
				}
			)
			fs.writeFileSync('./messages.json', JSON.stringify(messages), 'utf-8');
		}
		else {
			newParticipantList.push(participant)
		}
	})
	fs.writeFileSync('./participants.json', JSON.stringify(newParticipantList), 'utf-8');
}

setInterval(removeAfkUsers, 15000);

app.listen(4000);