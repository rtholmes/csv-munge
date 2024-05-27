# csv-munge

A simple program for transforming CSV files. This seems more complicated than 
it needs to be, but sometimes you just need a more general bit of code and the
boilerplate in here has been written over and over in lots of prior scripts.

While you'll want to make your own method for transforming the data, two 
samples are provided in `CSVMunger`:

    * `testCSV()` shows how it works with a simple example.

    * `qualtrics310_2022W2_AISurvey()` shows a real example reading a Qualtrics CSV file and transforming it into a new CSV file, and emitting a bunch of 'cards' on the console that can then be printed. 
