import {parse} from "csv-parse";
import * as fs from "fs-extra";


/**
 * Rows in the CSV will contain at least one column of interest. The CSVShape
 * is a way to represent the required columns, what an analysis would want to
 * call them, and what their type is.
 */
type CSVShape = { csvColName: string, outName: string, kind: "number" | "string" };

/**
 * A DataShape is a single column in the CSV that has been extracted and
 * renamed. If the value is empty in the CSV for that value the DataShape
 * will not exist.
 */
type DataShape = { name: string, value: number | string };

/**
 * A DataRow is a list of DataShapes. Each DataShape represents a column in the
 * CSV that has been munged into a format that is useful for analysis.
 */
type DataRow = DataShape[];

class CSVMunger {
	private inputCSV: string;
	private outputFile: string;

	constructor(inputCSV: string, outputFile: string) {
		console.log("CSVMunger::<init>");
		this.inputCSV = inputCSV;
		this.outputFile = outputFile;
	}

	/**
	 * Read the CSV and munge it into rows that contain the required Data Shapes.
	 *
	 * @param {CSVShape[]} shape
	 * @return {Promise<DataRow[]>}
	 */
	public async munge(shape: CSVShape[], valuesToIgnore: string[]): Promise<DataRow[]> {
		console.log("Munging CSV...");

		const ret: DataRow[] = [];

		// fails sensibly if the path is absent
		const realPath = fs.realpathSync(this.inputCSV);
		console.log("CSVMunger::munge() - realPath: " + realPath);

		const rawCSV = await CSVMunger.parseCSV(this.inputCSV) as any[];
		console.log("ExamCSVUploader::readCSV(..) - read");

		for (const row of rawCSV) {

			const dataRow: DataRow = [];
			for (const s of shape) {

				// make sure required header exists
				if (typeof row[s.csvColName] === "undefined") {
					// TODO: decide if this should be an error
					console.log("CSVMunger::munge(..) - column: " + s.csvColName + " missing from: " + JSON.stringify(row));
				} else {
					// if data exists, add it to the row
					const data: DataShape = {name: "", value: ""};
					let rawValue = row[s.csvColName];
					rawValue = rawValue.trim();
					rawValue.replaceAll("\n", " ");
					// don't add the value if:
					// * it is empty
					// * it is something we are explicitly ignoring
					if (rawValue.length > 0 && valuesToIgnore.includes(rawValue.toLowerCase()) === false) {
						if (s.kind === "number") {
							data.value = Number(rawValue);
						} else {
							data.value = rawValue;
						}
						data.name = s.outName;
						dataRow.push(data);
					}
				}
			}

			// if DataRow contains data, add an id shape
			if (dataRow.length > 0) {
				const id: DataShape = {name: "csvRowNum", value: ret.length};
				dataRow.unshift(id);
				ret.push(dataRow); // only add a row if it has _some_ data
			}
		}

		console.log("ExamCSVUploader::readCSV(..) - done; # rows: " + ret.length);
		return ret;
	}

	public static async parseCSV(fName: string): Promise<any> {
		console.log("GradeUploader::parseCSV(..) - start; path: " + fName);
		return new Promise(function (fulfill, reject) {

			const rs = fs.createReadStream(fName);
			const options = {
				columns: true,
				skip_empty_lines: true,
				trim: true,
				bom: true // fixes CSV compatibility issue
			};

			const parser = parse(options, (err: Error, data: any[]) => {
				if (err) {
					const msg = "CSV parse error: " + err;
					console.log("GradeUploader::parseCSV(..) - ERROR: " + msg);
					reject(new Error(msg));
				} else {
					console.log("GradeUploader::parseCSV(..) - parsing successful; # rows: " + data.length);
					fulfill(data);
				}
			});

			console.log("GradeUploader::parseCSV(..) - piping fs to parser");
			rs.pipe(parser);
		});
	}

}

/**
 * CPSC 310 2022W2 End-of-term AI survey. This method post-processes
 * the Qualtrics CSV output to prepare it for a card sort.
 *
 * Data: https://ubc.yul1.qualtrics.com/responses/#/surveys/SV_7OqooK2ep2CV5b0
 */
async function qualtrics310_2022W2_AISurvey() {
	const inF = "data/cpsc310_23w1_exit-survey.csv";
	const outF = "data/output.json";
	const valuesToIgnore = ["no", "no.", "nope", "nope.", "none", "n/a", "n/a.", "na",
		"-", "yes", "yes.", "no concerns", "no concerns."];
	const csvShapes: CSVShape[] = [
		{csvColName: "Q3", outName: "IU", kind: "string"}, // InfluenceUnderstanding
		{csvColName: "Q4", outName: "AIC", kind: "string"} // AIConcerns
	];

	// convert the CSV into DataRow objects
	const munger = new CSVMunger(inF, outF);
	const rows = await munger.munge(csvShapes, valuesToIgnore);
	await fs.writeJson(outF, rows, {spaces: 2}); // write processed rows

	// convert into strings for printing cards for card sort
	let strOut = "";
	for (const row of rows) {
		const id = row[0].value;
		for (const col of row) {
			if (col.name !== "csvRowNum") {
				strOut += col.value + " (r" + id + "_" + col.name + ")\n\n\n";
			}
		}
	}
	console.log(strOut);
}

async function bucket_grading_survey() {
	const inF = "data/bucket-grading.csv";
	const outF = "data/bucket-output.json";
	// const valuesToIgnore = [];
	const valuesToIgnore = ["no", "no.", "nope", "nope.", "none", "n/a", "n/a.", "na",
		"-", "yes", "yes.", "no concerns", "no concerns."];
	const csvShapes: CSVShape[] = [
		{csvColName: "Q2", outName: "CodeQual", kind: "string"}, // How did you assess code quality? (i.e. local test vs autotest)
		// {csvColName: "Q6", outName: "Lec", kind: "string"}, // How well did project material relate to lecture material?
		// {csvColName: "Q11", outName: "NonCode", kind: "string"}, // Did the non-code tasks affect your implementation strategy in subsequent deliverables?
		// {csvColName: "Q21", outName: "Smoke", kind: "string"}, // smoke test feedback: how did you use?
		// {csvColName: "Q27", outName: "Addtl", kind: "string"}, // additional feedback: how did you use?
		// {csvColName: "Q5", outName: "BucketStrat", kind: "string" }, // how did bucket grading influence your strategy?
		// {csvColName: "Q28", outName: "BucketInterp", kind: "string"}, // how did you interpret your bucket label? (i.e. as a bucket or label?)
		// {csvColName: "Q10", outName: "BucketGeneral", kind: "string"}, // general positives/negatives from bucket grading
	];

	// convert the CSV into DataRow objects
	const munger = new CSVMunger(inF, outF);
	const rows = await munger.munge(csvShapes, valuesToIgnore);
	await fs.writeJson(outF, rows, {spaces: 2}); // write processed rows

	// convert into strings for printing cards for card sort
	let strOut = "";
	for (const row of rows) {
		const id = row[0].value;
		for (const col of row) {
			if (col.name !== "csvRowNum") {
				strOut += col.value + " (r" + id + "_" + col.name + ")\n\n\n";
			}
		}
	}
	console.log(strOut);
}

/**
 * Sample processing method as an exemplar for getting started.
 */
async function testCSV() {
	const inF = "data/test.csv";
	const outF = "data/testOutput.json";
	const valuesToIgnore = ["no", "n/a", "yes"];
	const csvShapes: CSVShape[] = [
		{csvColName: "Col1", outName: "Data1", kind: "string"},
		{csvColName: "Col2", outName: "Data2", kind: "string"}
	];

	// convert the CSV into DataRow objects
	const munger = new CSVMunger(inF, outF);
	const rows = await munger.munge(csvShapes, valuesToIgnore);
	await fs.writeJson(outF, rows, {spaces: 2}); // write processed rows

	// convert into strings for printing cards for card sort
	let strOut = "";
	for (const row of rows) {
		const id = row[0].value;
		for (const col of row) {
			if (col.name !== "csvRowNum") {
				strOut += col.value + " (r" + id + "_" + col.name + ")\n\n\n";
			}
		}
	}
	console.log(strOut);
}

// call async function
// easiest to just create private async functions for each survey rather
// than modify this bootstrap function (also makes it easier to see different
// ways that surveys can be processed)
(async () => {
	try {
		console.log("CSVMunger::main() - start");
		// await qualtrics310_2022W2_AISurvey();
		await bucket_grading_survey();
		console.log("CSVMunger::main() - done");
	} catch (e) {
		// Deal with the fact the chain failed
		console.error("CSVMunger::main() - ERROR: " + e);
	}
})();


// ResponseID,ResponseSet,IPAddress,StartDate,EndDate,RecipientLastName,RecipientFirstName,RecipientEmail,ExternalDataReference,Finished,Status,  Study title: Improving Automated Assessments with Bucket Grading Project Investigator: Professo...,Thank you for participating in the survey. You will be asked to provide your CWL at the end of th...,"What techniques, tools, or methodologies did you use to assess the overall quality of your code s...","When encountering an issue, defect, or feedback, what did you do to resolve the issue in general?...",How well did material covered in the project (code and non-code) reflect the material in lecture...,"What are some of the most important or valuable concepts, techniques, or learnings, you learned f...",Did the non-code tasks affect your implementation strategy or behaviour in subsequent deliverable...,How did you approach managing and maintaining your code’s maintainability throughout the project?...,"Given the following options detailing modifications to AutoTest, which of the following would you...",Describe why you chose the option you did,"For each of the following pieces of AutoTest feedback, please describe if you used it and how hel...", ,Please rate your experiences using the #check command feedback-I used this feedback frequently,Please rate your experiences using the #check command feedback-This feedback was useful,How did you use this feedback? What was it especially helpful or not helpful for?, ,Please rate your experiences using the smoke test feedback-I used this feedback frequently,Please rate your experiences using the smoke test feedback-This feedback was useful,How did you use this feedback? What was it especially helpful or not helpful for?, ,Please rate your experiences using the additional feedback (artifact quality and focus area)-I used this feedback frequently,Please rate your experiences using the additional feedback (artifact quality and focus area)-This feedback was useful,How did you use this feedback? What was it especially helpful or not helpful for?,"How did the bucket grading system affect your implementation strategy? If it did not, you may spe...","When your deliverable was assigned a bucket label (i.e. Beginning, Acquiring, Developing, Profici...","Reflect on your interaction with bucket grading this semester. What were any positives, negatives...",CWL,LocationLatitude,LocationLongitude,LocationAccuracy
