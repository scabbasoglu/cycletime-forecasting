$(document).ready(initializePage);

function initializePage() {

    $("#run-forecast-button").click(runSimulation);
}

function runSimulation() {

    var AMOUNT_OF_SIMULATIONS = 600,
        SPREAD_SHEET_KEY = "1b1P-4CYgJwleJuNgsylD7yPjyIFuMkL1ZSRsFKFdofg",
        estimatedDays = parseInt($("#estimated-days").val()),
        amountOfStories = parseInt($("#number-of-stories").val()),
        randomPicker = new RandomPicker(Math),
        googleSpreadSheet = new GoogleSpreadSheet(SPREAD_SHEET_KEY),
        bowlFactory = new BowlFactory(randomPicker),
        realTaskRecordSource = new RealTaskRecordSource(googleSpreadSheet),
        workInProgressSource = new WorkInProgressSource(realTaskRecordSource, bowlFactory),
        simulationTaskSource = new SimulationTaskSource(realTaskRecordSource, bowlFactory),
        scenarioGenerator = new ScenarioGenerator(Scenario, workInProgressSource, simulationTaskSource, amountOfStories),
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

//TODO: This looks like shit. Try Promise pattern instead
function ScenarioGenerator(Scenario, workInProgressSource, simulationTaskSource, amountOfStories) {

    this.Scenario = Scenario;
    this.workInProgressSource = workInProgressSource;
    this.simulationTaskSource = simulationTaskSource;
    this.amountOfStories = amountOfStories;
}

ScenarioGenerator.prototype.generate = function (onGenerationComplete) {

    var that = this;

    this.workInProgressSource.readBowl(function (workInProgressBowl) {

        that.simulationTaskSource.readBowl(function (simulationTaskBowl) {

            var maxWorkInProgress = workInProgressBowl.pick(),
                simulationTaskArray = simulationTaskBowl.pickMultiple(that.amountOfStories),
                scenario = new that.Scenario(maxWorkInProgress, simulationTaskArray);
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

function WorkInProgressSource(realTaskRecordSource, bowlFactory) {

    this.realTaskRecordSource = realTaskRecordSource;
    this.bowlFactory = bowlFactory;
}

// TODO: this is returning bowl not array. Should be renamed
WorkInProgressSource.prototype.readBowl = function (onReadComplete) {

    var that = this;
    this.realTaskRecordSource.readRecordArray(function (realTaskRecordArray) {

        var workInProgressBowl = that.bowlFactory.createBowl();
        new WorkInProgressCalculator(realTaskRecordArray, workInProgressBowl).fillBowl();
        onReadComplete(workInProgressBowl);
    });
};

function WorkInProgressCalculator(realTaskRecordArray, bowl) {

    this.realTaskRecordArray = realTaskRecordArray;
    this.bowl = bowl;
    this.firstDate = null;
    this.lastDate = null;
}

WorkInProgressCalculator.prototype.fillBowl = function () {

    var that = this;
    decideFirstAndLastDates();
    fillWorkInProgressBowl();

    function decideFirstAndLastDates() {

        var firstWorkDay = null,
            lastWorkDay = null;

        that.realTaskRecordArray.forEach(function (realTaskRecord) {

            if (firstWorkDay === null || firstWorkDay.biggerThan(realTaskRecord.startDate)) {

                firstWorkDay = realTaskRecord.startDate;
            }

            if (lastWorkDay === null || lastWorkDay.smallerThan(realTaskRecord.endDate)) {

                lastWorkDay = realTaskRecord.endDate;
            }
        });

        that.firstWorkDay = firstWorkDay;
        that.lastWorkDay = lastWorkDay;
    }

    function fillWorkInProgressBowl() {

        var workInProgressForDate,
            workDay;

        for (workDay = that.firstWorkDay; workDay.smallerThan(that.lastWorkDay); workDay = workDay.getNextDay()) {

            workInProgressForDate = calculateWorkInProgress(workDay);
            that.bowl.add(workInProgressForDate);
        }
    }

    function calculateWorkInProgress(dateToCalculate) {

        var workInProgress = 0;

        that.realTaskRecordArray.forEach(function (realTaskRecord) {

            if (realTaskRecord.wasActive(dateToCalculate)) {

                workInProgress += 1;
            }
        });

        return workInProgress;
    }
}

function SimulationTaskSource(realTaskRecordSource, bowlFactory) {

    this.realTaskRecordSource = realTaskRecordSource;
    this.bowlFactory = bowlFactory;
}

// TODO: this is returning bowl not array. Should be renamed
SimulationTaskSource.prototype.readBowl = function (onReadComplete) {

    var that = this;
    this.realTaskRecordSource.readRecordArray(function (realTaskRecordArray) {

        var simulationTaskBowl = that.bowlFactory.createBowl();

        realTaskRecordArray.forEach(function (realTaskRecord) {

            var simulationTask = new SimulationTask(realTaskRecord.getCycleTime());
            simulationTaskBowl.add(simulationTask);
        });

        onReadComplete(simulationTaskBowl);
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

function RealTaskRecord(startDateString, endDateString) {

    this.startDate = new WorkDay(startDateString);
    this.endDate = new WorkDay(endDateString);
}

RealTaskRecord.prototype.wasActive = function (date) {

    return date.isInBetween(this.startDate, this.endDate);
}

RealTaskRecord.prototype.getCycleTime = function () {

    return this.endDate.dayDifference(this.startDate);
}

function WorkDay(dateInString) {

    if (dateInString) {
        var parts = dateInString.split('-');
        this.date = new Date(parts[0], parts[1] - 1, parts[2]);
    }
}

WorkDay.prototype.MS_TO_DAYS = 1 / (24 * 60 * 60 * 1000);
WorkDay.prototype.getNextDay = function () {

    var nextWorkDay = new WorkDay();
    nextWorkDay.date = new Date(this.date);
    nextWorkDay.date.setDate(this.date.getDate() + 1);
    return nextWorkDay;
};

WorkDay.prototype.isInBetween = function (startWorkDate, endWorkDate) {

    return startWorkDate.date <= this.date && this.date < endWorkDate.date;
};

WorkDay.prototype.dayDifference = function (dayToCompare) {

    return (this.date.getTime() - dayToCompare.date.getTime()) * this.MS_TO_DAYS;
};

WorkDay.prototype.smallerThan = function (dayToCompare) {

    return this.date < dayToCompare.date;
};

WorkDay.prototype.biggerThan = function (dayToCompare) {

    return this.date > dayToCompare.date;
};

// Not Under Unit Test Coverage
function GoogleSpreadSheet(spreadSheetKey) {

    this.spreadsheetUrl = "https://spreadsheets.google.com/feeds/cells/" +
        spreadSheetKey +
        "/od6/public/values?alt=json-in-script&callback=?";
}

// Not Under Unit Test Coverage
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

function BowlFactory(randomPicker) {

    this.randomPicker = randomPicker;
}

BowlFactory.prototype.createBowl = function () {

    return new Bowl(this.randomPicker);
}

function Bowl(randomPicker) {

    this.randomPicker = randomPicker;
    this.contentArray = [];
}

Bowl.prototype.add = function (objectToAdd) {

    this.contentArray.push(objectToAdd);
}

Bowl.prototype.pick = function () {

    this.assertNotEmpty();

    return this.randomPicker.pickFromArray(this.contentArray);
}

Bowl.prototype.pickMultiple = function (amount) {

    var pickIndex,
        picked,
        pickedArray = [];

    this.assertNotEmpty();

    for (pickIndex = 0; pickIndex < amount; pickIndex += 1) {

        var picked = this.randomPicker.pickFromArray(this.contentArray);
        pickedArray.push(picked);
    }

    return pickedArray;
}

Bowl.prototype.assertNotEmpty = function () {

    if (this.contentArray.length === 0) {

        throw new Error("Trying to pick from an empty bowl");
    }
}

function RandomPicker(randomizer) {

    this.randomizer = randomizer;
}

RandomPicker.prototype.pickFromArray = function (sourceArray) {

    var randomIndex = Math.floor(this.randomizer.random() * sourceArray.length);
    return sourceArray[randomIndex];
}