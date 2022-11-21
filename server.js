require("dotenv").config();

const express = require("express");
const app = express();

const http = require("http");
const server = http.createServer(app);

const path = require("path");

const { DB_URL } = process.env;
const { Client } = require("pg");
const db = new Client(DB_URL);

db.connect((err) => {
	if (err) {
		console.error(err.message);
		process.exit(1);
	}

	console.log("Connected to database.");

	db.query(
		"CREATE TABLE IF NOT EXISTS poll(id SERIAL PRIMARY KEY, name TEXT NOT NULL, password TEXT NOT NULL, options TEXT[] DEFAULT '{}', polls INTEGER[] DEFAULT '{}')",
		(err) => {
			if (err) {
				console.error(err.message);
				process.exit(1);
			}

			console.log("Created poll table.");
		}
	);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.set("views", "src");

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "src", "index.html")));
app.get("/create", (_req, res) => res.sendFile(path.join(__dirname, "src", "createPoll.html")));
app.get("/result", (req, res) => {
	const { id } = req.query;

	if (id) {
		db.query("SELECT * FROM poll WHERE id = $1", [id], (err, result) => {
			if (err) {
				res.render("error", { message: "An error occurred.\nError message: " + err.message });
				console.error(err.message);
				return;
			}

			if (result.rows[0]) {
				const { id, name, options, polls } = result.rows[0];
				res.render("result", { id, name, options, polls });
			} else {
				res.render("error", { message: "The poll is closed." });
			}
		});
	}
});
app.get("/poll", (req, res) => {
	const { id } = req.query;

	if (id) {
		db.query("SELECT name, options FROM poll WHERE id = $1", [id], (err, result) => {
			if (err) {
				res.render("error", { message: "An error occurred.\nError message: " + err.message });
				console.error(err.message);
				return;
			}

			if (result.rows[0]) {
				const { name, options } = result.rows[0];
				res.render("poll", { name, options });
			} else {
				res.render("error", { message: "The poll is closed." });
			}
		});
	}
});

app.post("/create", (req, res) => {
	const { name, options, password } = req.body;

	db.query("INSERT INTO poll(name, options, password) VALUES($1, $2, $3)", [name, options.slice(0, 20), password], (err) => {
		if (err) {
			res.render("error", { message: "An error occurred.\nError message: " + err.message });
			console.error(err.message);
			return;
		}

		db.query("SELECT id FROM poll WHERE id = (SELECT MAX(id) FROM poll)", (err, result) => {
			if (err) {
				res.render("error", { message: "An error occurred.\nError message: " + err.message });
				console.error(err.message);
				return;
			}

			res.redirect("/result?id=" + result.rows[0].id);
		});
	});
});
app.post("/poll", (req, res) => {
	const { id, option } = req.body;

	db.query("UPDATE poll SET polls = ARRAY_APPEND(polls, $2) WHERE id = $1", [id, option], (err) => {
		if (err) {
			res.render("error", { message: "An error occurred.\nError message: " + err.message });
			console.error(err.message);
			return;
		}

		res.redirect("/result?id=" + id);
	});
});
app.post("/close", (req, res) => {
	const { id, password } = req.body;

	if (id) {
		db.query("SELECT password FROM poll WHERE id = $1", [id], (err, result) => {
			if (err) {
				res.sendStatus(500);
				console.error(err.message);
				return;
			}

			if (result.rows[0].password !== password) {
				res.sendStatus(423);
				return;
			}

			db.query("DELETE FROM poll WHERE id = $1", [id], (err) => {
				if (err) {
					res.sendStatus(500);
				} else {
					res.sendStatus(200);
				}
			});
		});
	}
});

app.use(express.static("src"));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log("Server started. PORT: " + PORT));
