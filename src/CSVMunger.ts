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

		// NOTE: while it would be better for these to not be hard-coded,
		// we can also just make sure the columns have the right name in Qualtrics
		const STUDENT_NUMBER_HEADER = "StudentNumber";
		const GRADE_HEADER = "FinalExamGrade";

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
		await testCSV();
		console.log("CSVMunger::main() - done");
	} catch (e) {
		// Deal with the fact the chain failed
		console.error("CSVMunger::main() - ERROR: " + e);
	}
})();

