import {parse} from "csv-parse";
import * as fs from "fs";


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
	public async munge(shape: CSVShape[]): Promise<DataRow[]> {
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
					for (const s of shape) {
						const data: DataShape = {name: "", value: ""};
						let rawValue = row[s.csvColName];
						rawValue = rawValue.trim();
						// if the value is empty, we don't need to add it
						if (rawValue.length > 0) {
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
			}

			// if DataRow contains data, add an id shape
			if (dataRow.length > 0) {
				const id: DataShape = {name: "csvRowNum", value: ret.length};
				dataRow.unshift(id);
			}

			ret.push(dataRow);
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

async function qualtrics310_2022W2_AISurvey() {
	const inF = "data/cpsc310_23w1_exit-survey.csv";
	const outF = "data/output.csv";
	const csvm = new CSVMunger(inF, outF);

	const csvShapes: CSVShape[] = [
		{csvColName: "Q3", outName: "InfluenceUnderstanding", kind: "string"},
		{csvColName: "Q4", outName: "AIConcerns", kind: "string"}
	];

	const rows = await csvm.munge(csvShapes);
	console.table(rows);
}


// call async function
// easiest to just create private async functions for each survey rather
// than modify this bootstrap function (also makes it easier to see different
// ways that surveys can be processed)
(async () => {
	try {
		console.log("CSVMunger::main() - start");
		await qualtrics310_2022W2_AISurvey();
		console.log("CSVMunger::main() - done");
	} catch (e) {
		// Deal with the fact the chain failed
		console.error("CSVMunger::main() - ERROR: " + e);
	}
})();

