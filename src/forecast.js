$(document).ready(initializePage);

function initializePage() {

    $("#run-forecast-button").click(runSimulation);
}

function runSimulation() {

    var AMOUNT_OF_SIMULATIONS = 100,
        SPREAD_SHEET_KEY = "1b1P-4CYgJwleJuNgsylD7yPjyIFuMkL1ZSRsFKFdofg",
        estimatedDays = parseInt($("#estimated-days").val()),
        amountOfStories = parseInt($("#number-of-stories").val()),
        randomPicker = new RandomPicker(Math),
        googleSpreadSheet = new GoogleSpreadSheet(SPREAD_SHEET_KEY),
        realTaskRecordSource = new RealTaskRecordSource(googleSpreadSheet),
        workInProgressSource = new WorkInProgressSource(realTaskRecordSource),
        workInProgressBucket = new Bucket(randomPicker, workInProgressSource),
        simulationTaskSource = new SimulationTaskSource(realTaskRecordSource),
        simulationTaskBucket = new Bucket(randomPicker, simulationTaskSource),
        scenarioGenerator = new ScenarioGenerator(Scenario, workInProgressBucket, simulationTaskBucket, amountOfStories),
        simulator = new Simulator(Simulation, scenarioGenerator, estimatedDays);

    new Forecast(AMOUNT_OF_SIMULATIONS, simulator, displayForecast).calculate();
}

function displayForecast(probability) {

    $("#probability-of-success").val(probability);
}

function Forecast(amountOfSimulations, simulator, displayForecast) {

    this.amountOfSimulations = amountOfSimulations;
    this.simulator = simulator;
    this.displayForecast = displayForecast;
}

Forecast.prototype.calculate = function () {

    var completedSimulations = 0;
    var successfulSimulations = 0;
    var that = this;

    runNextSimulation();

    function onSimulationComplete(simulationResult) {

        completedSimulations += 1;

        if (simulationResult === true) {
            successfulSimulations += 1;
        }

        if (completedSimulations < that.amountOfSimulations) {
            runNextSimulation();
        } else {
            displayResult();
        }
    }

    function displayResult() {

        var successRate = successfulSimulations / completedSimulations
        that.displayForecast(successRate);
    }

    function runNextSimulation() {

        that.simulator.run(onSimulationComplete);
    }
};

function Simulator(Simulation, scenarioGenerator, estimatedDays) {

    this.Simulation = Simulation;
    this.scenarioGenerator = scenarioGenerator;
    this.estimatedDays = estimatedDays;
}

Simulator.prototype.run = function (onSimulationComplete) {

    var that = this;
    this.scenarioGenerator.generate(function (scenario) {

        new that.Simulation(scenario, that.estimatedDays, onSimulationComplete).run();
    });
};

function Simulation(scenario, estimatedDays, onSimulationComplete) {

    this.scenario = scenario;
    this.estimatedDays = estimatedDays;
    this.onSimulationComplete = onSimulationComplete;
}

Simulation.prototype.run = function () {

    var progress,
        isSuccessful;

    for (progress = 0; progress < this.estimatedDays; progress += 1) {

        this.scenario.progressOneDay();
    }

    isSuccessful = this.scenario.isComplete();
    this.onSimulationComplete(isSuccessful);
};

//TODO: This looks like shit
function ScenarioGenerator(Scenario, workInProgressBucket, simulationTaskBucket, amountOfStories) {

    this.Scenario = Scenario;
    this.workInProgressBucket = workInProgressBucket;
    this.simulationTaskBucket = simulationTaskBucket;
    this.amountOfStories = amountOfStories;
}

ScenarioGenerator.prototype.generate = function (onGenerationComplete) {

    var that = this;

    this.workInProgressBucket.pick(function (maxWorkInProgress) {

        that.simulationTaskBucket.pickArray(that.amountOfStories, function (simulationTaskArray) {

            var scenario = new that.Scenario(maxWorkInProgress, simulationTaskArray);
            onGenerationComplete(scenario);
        });
    });
};

function Scenario(maxWorkInProgress, simulationTaskArray) {

    this.maxWorkInProgress = maxWorkInProgress;
    this.simulationTaskArray = simulationTaskArray;
}

Scenario.prototype.progressOneDay = function () {

    var progressedWorkAmount = 0;
    var that = this;

    this.simulationTaskArray.forEach(function (simulationTask) {

        if (progressedWorkAmount >= that.maxWorkInProgress) {
            return;
        }

        if (simulationTask.isComplete()) {
            return;
        }

        simulationTask.progressOneDay();
        progressedWorkAmount += 1;
    });
};

Scenario.prototype.isComplete = function () {

    var isComplete = true;

    this.simulationTaskArray.forEach(function (simulationTask) {

        if (simulationTask.isComplete() === false) {

            isComplete = false;
        }
    });

    return isComplete;
};

// TODO: Bucket should not be using source, instead it should be a wrapper created by source
function Bucket(randomPicker, source) {

    this.randomPicker = randomPicker;
    this.source = source;
}

Bucket.prototype.pick = function (onPick) {

    var randomPicker = this.randomPicker;

    this.source.readArray(function (sourceArray) {

        var randomPick = randomPicker.pickFromArray(sourceArray);
        onPick(randomPick);
    });
};

Bucket.prototype.pickArray = function (arraySize, onPick) {

    var randomPicker = this.randomPicker;

    this.source.readArray(function (sourceArray) {

        if (sourceArray.length === 0) {

            onPick([]);
            return;
        }

        var pickIndex,
            randomPick,
            pickedArray = [];

        for (pickIndex = 0; pickIndex < arraySize; pickIndex += 1) {

            var randomPick = randomPicker.pickFromArray(sourceArray);
            pickedArray.push(randomPick);
        }

        onPick(pickedArray);
    });
};

function RandomPicker(randomizer) {

    this.randomizer = randomizer;
}

RandomPicker.prototype.pickFromArray = function (sourceArray) {

    var randomIndex = Math.floor(this.randomizer.random() * sourceArray.length);
    return sourceArray[randomIndex];
}

function WorkInProgressSource(realTaskRecordSource) {

    this.realTaskRecordSource = realTaskRecordSource;
}

WorkInProgressSource.prototype.readArray = function (onReadComplete) {

    this.realTaskRecordSource.readRecordArray(function (realTaskRecordArray) {

        var workInProgressArray = new WorkInProgressCalculator(realTaskRecordArray).calculate();
        onReadComplete(workInProgressArray);
    });
};

function WorkInProgressCalculator(realTaskRecordArray) {

    this.realTaskRecordArray = realTaskRecordArray;
    this.workInProgressArray = [];
    this.firstDate = null;
    this.lastDate = null;
}

WorkInProgressCalculator.prototype.calculate = function () {

    this.decideFirstAndLastDates();
    return this.createWorkInProgressArray();
}

//TODO: Should be private
WorkInProgressCalculator.prototype.decideFirstAndLastDates = function () {

    var firstWorkDay = null,
        lastWorkDay = null;

    this.realTaskRecordArray.forEach(function (realTaskRecord) {

        if (firstWorkDay === null || firstWorkDay.getDate() > realTaskRecord.startDate.getDate()) {

            firstWorkDay = realTaskRecord.startDate;
        }

        if (lastWorkDay === null || lastWorkDay.getDate() < realTaskRecord.endDate.getDate()) {

            lastWorkDay = realTaskRecord.endDate;
        }
    });

    this.firstWorkDay = firstWorkDay;
    this.lastWorkDay = lastWorkDay;
}

//TODO: Should be private
WorkInProgressCalculator.prototype.createWorkInProgressArray = function () {

    var workInProgressArray = [],
        workInProgressForDate,
        dateToCalculate;

    for (dateToCalculate = this.firstWorkDay; dateToCalculate.getDate() < this.lastWorkDay.getDate(); dateToCalculate = dateToCalculate.getNextDay()) {

        workInProgressForDate = this.calculateWorkInProgress(dateToCalculate.getDate());
        workInProgressArray.push(workInProgressForDate);
    }

    return workInProgressArray;
}

//TODO: Should be private
WorkInProgressCalculator.prototype.calculateWorkInProgress = function (dateToCalculate) {

    var workInProgress = 0;

    this.realTaskRecordArray.forEach(function (realTaskRecord) {

        if (realTaskRecord.wasActive(dateToCalculate)) {

            workInProgress += 1;
        }
    });

    return workInProgress;
}

function RealTaskRecordSource(googleSpreadSheet) {

    this.googleSpreadSheet = googleSpreadSheet;
    this.cachedRealTaskRecordArray = null;
}

RealTaskRecordSource.prototype.readRecordArray = function (onReadComplete) {

    var that = this;

    if (this.cachedRealTaskRecordArray != null) {

        onReadComplete(this.cachedRealTaskRecordArray);
        return;
    }

    this.googleSpreadSheet.readCellArray(function (cellArray) {

        var realTaskRecordMap = createRecordMap(cellArray);

        var realTaskRecordArray = [];
        var recordValue;

        for (recordValue of realTaskRecordMap.values()) {

            var realTaskRecord = new RealTaskRecord(recordValue.startDate, recordValue.endDate);
            realTaskRecordArray.push(realTaskRecord);
        }

        that.cachedRealTaskRecordArray = realTaskRecordArray;
        onReadComplete(realTaskRecordArray);
    });

    function createRecordMap(cellArray) {

        var realTaskRecordMap = new Map();

        cellArray.forEach(function (cell) {

            if (realTaskRecordMap.has(cell.rowIndex) == false) {

                realTaskRecordMap.set(cell.rowIndex, {});
            }

            var recordInMap = realTaskRecordMap.get(cell.rowIndex);

            if (cell.columnIndex === 2) {

                recordInMap.startDate = cell.value;
            } else if (cell.columnIndex === 3) {

                recordInMap.endDate = cell.value;
            }
        });

        return realTaskRecordMap;
    }
};

function SimulationTaskSource(realTaskRecordSource) {

    this.realTaskRecordSource = realTaskRecordSource;
}

SimulationTaskSource.prototype.readArray = function (onReadComplete) {

    this.realTaskRecordSource.readRecordArray(function (realTaskRecordArray) {

        var simulationTaskArray = [];

        realTaskRecordArray.forEach(function (realTaskRecord) {

            var simulationTask = new SimulationTask(realTaskRecord.getCycleTime());
            simulationTaskArray.push(simulationTask);
        });

        onReadComplete(simulationTaskArray);
    });
};

function SimulationTask(cycleTime) {

    this.cycleTime = cycleTime;
    this.currentProgress = 0;
}

SimulationTask.prototype.progressOneDay = function () {

    this.currentProgress += 1;
};

SimulationTask.prototype.isComplete = function () {

    return this.currentProgress >= this.cycleTime;
};

function RealTaskRecord(startDateString, endDateString) {

    this.startDate = new WorkDay(startDateString);
    this.endDate = new WorkDay(endDateString);
}

RealTaskRecord.prototype.wasActive = function (date) {

    return this.startDate.getDate() <= date && this.endDate.getDate() > date;
}

RealTaskRecord.prototype.getCycleTime = function () {

    return this.substractDays(this.endDate.getDate(), this.startDate.getDate());
}

RealTaskRecord.prototype.MS_TO_DAYS = 1 / (24 * 60 * 60 * 1000);
RealTaskRecord.prototype.substractDays = function (date0, date1) {

    return (date0.getTime() - date1.getTime()) * this.MS_TO_DAYS;
}

//TODO: Extract to Date class
RealTaskRecord.prototype.parseDate = function (input) {

    var parts = input.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function WorkDay(dateInString) {

    if (dateInString) {
        var parts = dateInString.split('-');
        this.date = new Date(parts[0], parts[1] - 1, parts[2]);
    }
}

//TODO: Should not be used in production code.
WorkDay.prototype.getDate = function () {

    return this.date;
}

WorkDay.prototype.getNextDay = function () {

    var nextWorkDay = new WorkDay();
    nextWorkDay.date = new Date(this.date);
    nextWorkDay.date.setDate(this.date.getDate() + 1);
    return nextWorkDay;
}

// Not Tested
function GoogleSpreadSheet(spreadSheetKey) {

    this.spreadsheetUrl = "https://spreadsheets.google.com/feeds/cells/" +
        spreadSheetKey +
        "/od6/public/values?alt=json-in-script&callback=?";
}

// Not Tested
GoogleSpreadSheet.prototype.readCellArray = function (onReadComplete) {

    $.getJSON(this.spreadsheetUrl, {}, onJsonRead);

    function onJsonRead(spreadSheetJson) {

        var cellArray = [];

        spreadSheetJson.feed.entry.forEach(function (spreadSheetEntry) {

            var cell = {

                rowIndex: parseInt(spreadSheetEntry.gs$cell.row),
                columnIndex: parseInt(spreadSheetEntry.gs$cell.col),
                value: spreadSheetEntry.gs$cell.$t
            };

            cellArray.push(cell);
        });

        onReadComplete(cellArray);
    }
};