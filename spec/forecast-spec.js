describe("Forecast", function () {

    var forecast,
        simulator,
        amountOfSimulations = 4,
        displayForecast;

    beforeEach(function () {

        displayForecast = jasmine.createSpy("displayForecast");
        simulator = jasmine.createSpyObj("simulator", ["run"]);
        forecast = new Forecast(amountOfSimulations, simulator, displayForecast);
    });

    it("should run expected amount of simulations", function () {

        simulator.run.and.callFake(function (onSimulationComplete) {
            onSimulationComplete(false);
        });

        forecast.calculate();

        expect(simulator.run).toHaveBeenCalled();
        expect(simulator.run.calls.count()).toEqual(amountOfSimulations);
    });

    it("probability of success should be 0 if all simulations fail", function () {

        simulator.run.and.callFake(function (onSimulationComplete) {
            onSimulationComplete(false);
        });

        forecast.calculate();

        expect(displayForecast).toHaveBeenCalledWith(0);
    });

    it("probability of success should be 1 if all simulations are successful", function () {

        simulator.run.and.callFake(function (onSimulationComplete) {
            onSimulationComplete(true);
        });

        forecast.calculate();

        expect(displayForecast).toHaveBeenCalledWith(1);
    });

    it("probability of success should be 0.75 if 3 out of 4 simulations are successful", function () {

        var simulationIndex = -1;

        simulator.run.and.callFake(function (onSimulationComplete) {

            simulationIndex += 1;
            if (simulationIndex === 0) {
                onSimulationComplete(false);
            } else {

                onSimulationComplete(true);
            }
        });

        forecast.calculate();

        expect(displayForecast).toHaveBeenCalledWith(0.75);
    });
});

describe("Simulation", function () {

    var scenario,
        estimatedDays = 4,
        onSimulationComplete,
        simulation;

    beforeEach(function () {

        scenario = jasmine.createSpyObj("scenario", ["progressOneDay", "isComplete"]);
        onSimulationComplete = jasmine.createSpy("onSimulationComplete");
        simulation = new Simulation(scenario, estimatedDays, onSimulationComplete);
    });

    it("should progress scenario for estimated days", function () {

        simulation.run();

        expect(scenario.progressOneDay.calls.count()).toBe(4);
    });

    it("should complete with success if scenario is completed", function () {

        scenario.isComplete.and.returnValue(true);
        simulation.run();

        expect(onSimulationComplete).toHaveBeenCalledWith(true);
    });

    it("should complete with fail if scenario is not completed", function () {

        scenario.isComplete.and.returnValue(false);
        simulation.run();

        expect(onSimulationComplete).toHaveBeenCalledWith(false);
    });
});

describe("Scenario", function () {

    var maxWorkInProgress = 2,
        simulationTask0,
        simulationTask1,
        simulationTask2,
        scenario;

    beforeEach(function () {

        simulationTask0 = jasmine.createSpyObj("simulationTask0", ["isComplete", "progressOneDay"]);
        simulationTask1 = jasmine.createSpyObj("simulationTask1", ["isComplete", "progressOneDay"]);
        simulationTask2 = jasmine.createSpyObj("simulationTask2", ["isComplete", "progressOneDay"]);
        scenario = new Scenario(maxWorkInProgress, [simulationTask0, simulationTask1, simulationTask2]);
    });

    it("should be completed if all stories are completed", function () {

        simulationTask0.isComplete.and.returnValue(true);
        simulationTask1.isComplete.and.returnValue(true);
        simulationTask2.isComplete.and.returnValue(true);

        expect(scenario.isComplete()).toBe(true);
    });

    it("should NOT be completed if one story is not completed", function () {

        simulationTask0.isComplete.and.returnValue(true);
        simulationTask1.isComplete.and.returnValue(false);
        simulationTask2.isComplete.and.returnValue(true);

        expect(scenario.isComplete()).toBe(false);
    });

    it("should progress stories equal to max work in progress", function () {

        simulationTask0.isComplete.and.returnValue(false);
        simulationTask1.isComplete.and.returnValue(false);
        simulationTask2.isComplete.and.returnValue(false);

        scenario.progressOneDay();

        expect(simulationTask0.progressOneDay).toHaveBeenCalled();
        expect(simulationTask1.progressOneDay).toHaveBeenCalled();
        expect(simulationTask2.progressOneDay).not.toHaveBeenCalled();
    });

    it("should not progress stories already completed", function () {

        simulationTask0.isComplete.and.returnValue(true);
        simulationTask1.isComplete.and.returnValue(false);
        simulationTask2.isComplete.and.returnValue(false);

        scenario.progressOneDay();

        expect(simulationTask0.progressOneDay).not.toHaveBeenCalled();
        expect(simulationTask1.progressOneDay).toHaveBeenCalled();
        expect(simulationTask2.progressOneDay).toHaveBeenCalled();
    });
});

describe("SimulationTask", function () {

    it("should be completed if progressed more than cycle time", function () {

        var simulationTask = new SimulationTask(2);

        simulationTask.progressOneDay();
        simulationTask.progressOneDay();
        simulationTask.progressOneDay();

        expect(simulationTask.isComplete()).toBe(true);
    });

    it("should be completed if progressed equal to cycle time", function () {

        var simulationTask = new SimulationTask(2);

        simulationTask.progressOneDay();
        simulationTask.progressOneDay();

        expect(simulationTask.isComplete()).toBe(true);
    });

    it("should NOT be completed if progressed less than cycle time", function () {

        var simulationTask = new SimulationTask(2);

        simulationTask.progressOneDay();

        expect(simulationTask.isComplete()).toBe(false);
    });
});

describe("ScenarioGenerator", function () {

    it("should generate a scenario picking cycyle times and a maximum work in progress", function () {

        var maxWorkInProgress = 3,
            amountOfStories = 5,
            simulationTaskArray = ["user-story-0", "user-story-1"],
            workInProgressSource = jasmine.createSpyObj("workInProgressSource", ["readArray"]),
            fakeBowl = jasmine.createSpyObj("workInProgressBowl", ["pick", "pickArray"]),
            fakeBucket = jasmine.createSpyObj("workInProgressBucket", ["pick", "pickArray"]),
            onGenerationComplete = jasmine.createSpy("onGenerationComplete"),
            scenarioGenerator = new ScenarioGenerator(FakeScenario, workInProgressSource, fakeBucket, amountOfStories);


        workInProgressSource.readArray.and.callFake(function (onReadComplete) {

            onReadComplete(fakeBowl);
        });
        fakeBowl.pick.and.returnValue(maxWorkInProgress);

        fakeBucket.pickArray.and.callFake(function (arraySize, onPickComplete) {

            onPickComplete(simulationTaskArray);
        });

        scenarioGenerator.generate(onGenerationComplete);

        expect(fakeBucket.pickArray).toHaveBeenCalledWith(amountOfStories, jasmine.anything());
        var generatedScenario = onGenerationComplete.calls.mostRecent().args[0];
        expect(generatedScenario.maxWorkInProgress).toBe(maxWorkInProgress);
        expect(generatedScenario.simulationTaskArray).toBe(simulationTaskArray);
    });

    function FakeScenario(maxWorkInProgress, simulationTaskArray) {

        this.maxWorkInProgress = maxWorkInProgress;
        this.simulationTaskArray = simulationTaskArray;
    }
});

describe("Bucket", function () {

    var onPick,
        sourceArray = [1, 2, 3, 4, 5],
        randomPicker,
        source = {

            readArray: function (onRead) {

                onRead(sourceArray);
            }
        },
        bucket;

    beforeEach(function () {

        onPick = jasmine.createSpy("onPick");
        randomPicker = jasmine.createSpyObj("randomPicker", ["pickFromArray"]);
        bucket = new Bucket(randomPicker, source);
    });

    xit("should pick a random value provided by the source", function () {

        randomPicker.pickFromArray.and.returnValue(3);

        bucket.pick(onPick);

        expect(randomPicker.pickFromArray).toHaveBeenCalledWith(sourceArray);
        expect(onPick).toHaveBeenCalledWith(3);
    });

    xit("should pick an array of values from source", function () {

        var randomArray = [1, 3, 5];
        randomPicker.pickFromArray.and.callFake(function () {

            var randomValue = randomArray.shift();
            return randomValue;
        });

        bucket.pickArray(3, onPick);

        expect(onPick).toHaveBeenCalledWith([1, 3, 5]);
    });

    xit("should pick an empty array if source is empty", function () {

        spyOn(source, "readArray").and.callFake(function (onRead) {

            onRead([]);
        });

        bucket.pickArray(3, onPick);

        expect(onPick).toHaveBeenCalledWith([]);
    });
});


describe("WorkInProgressSource", function () {

    it("should create an array of work in progress for each day using real task records", function () {

        var realTaskRecordArray = [
                new RealTaskRecord("2015-04-03", "2015-04-06"),
                new RealTaskRecord("2015-04-04", "2015-04-05"),
                new RealTaskRecord("2015-04-04", "2015-04-06"),
                new RealTaskRecord("2015-04-05", "2015-04-06")
            ],
            realTaskRecordSource = {

                readRecordArray: function (onReadComplete) {

                    onReadComplete(realTaskRecordArray);
                }
            },
            onReadComplete = jasmine.createSpy("onReadComplete"),
            bowlFactory = jasmine.createSpyObj("bowlFactory", ["createBowl"]),
            expectedBowl = jasmine.createSpyObj("bowl", ["add"]),
            workInProgressSource = new WorkInProgressSource(realTaskRecordSource, bowlFactory);

        bowlFactory.createBowl.and.returnValue(expectedBowl);
        workInProgressSource.readArray(onReadComplete);

        expect(expectedBowl.add).toHaveBeenCalledWith(1);
        expect(expectedBowl.add).toHaveBeenCalledWith(3);
        expect(expectedBowl.add).toHaveBeenCalledWith(3);
        expect(onReadComplete).toHaveBeenCalledWith(expectedBowl);
    });
});

describe("SimulationTaskSource", function () {

    it("should create an array of simulation tasks using real task records", function () {

        var realTaskRecordArray = [
                new RealTaskRecord("2015-04-03", "2015-04-06"),
                new RealTaskRecord("2015-04-04", "2015-04-05"),
                new RealTaskRecord("2015-04-04", "2015-04-06"),
                new RealTaskRecord("2015-04-05", "2015-04-06")
            ],
            realTaskRecordSource = {

                readRecordArray: function (onReadComplete) {

                    onReadComplete(realTaskRecordArray);
                }
            },
            onReadComplete = jasmine.createSpy("onReadComplete"),
            bowlFactory = jasmine.createSpyObj("bowlFactory", ["createBowl"]),
            expectedBowl = jasmine.createSpyObj("bowl", ["add"]),
            simulationTaskSource = new SimulationTaskSource(realTaskRecordSource, bowlFactory);

        bowlFactory.createBowl.and.returnValue(expectedBowl);
        simulationTaskSource.readArray(onReadComplete);

        expect(expectedBowl.add).toHaveBeenCalledWith(new SimulationTask(3));
        expect(expectedBowl.add).toHaveBeenCalledWith(new SimulationTask(1));
        expect(expectedBowl.add).toHaveBeenCalledWith(new SimulationTask(2));
        expect(expectedBowl.add).toHaveBeenCalledWith(new SimulationTask(1));
        expect(onReadComplete).toHaveBeenCalledWith(expectedBowl);
    });
});

describe("RealTaskRecordSource", function () {

    var cellArray = [

            {
                rowIndex: 1,
                columnIndex: 1,
                value: "task-0"
                },
            {
                rowIndex: 1,
                columnIndex: 2,
                value: "2015-04-03"
                },
            {
                rowIndex: 1,
                columnIndex: 3,
                value: "2015-04-06"
                },
            {
                rowIndex: 2,
                columnIndex: 1,
                value: "task-1"
                },
            {
                rowIndex: 2,
                columnIndex: 2,
                value: "2015-04-04"
                },
            {
                rowIndex: 2,
                columnIndex: 3,
                value: "2015-04-05"
                },
            {
                rowIndex: 3,
                columnIndex: 1,
                value: "task-2"
                },
            {
                rowIndex: 3,
                columnIndex: 2,
                value: "2015-04-04"
                },
            {
                rowIndex: 3,
                columnIndex: 3,
                value: "2015-04-05"
                },
            ],
        googleSpreadSheet,
        onReadComplete,
        realTaskRecordSource;

    beforeEach(function () {

        onReadComplete = jasmine.createSpy("onReadComplete");
        googleSpreadSheet = {

            readCellArray: function (onReadComplete) {

                onReadComplete(cellArray);
            }
        };
        realTaskRecordSource = new RealTaskRecordSource(googleSpreadSheet);

        spyOn(googleSpreadSheet, "readCellArray").and.callThrough();
    });

    it("should create an array of real task records using excel cells", function () {

        realTaskRecordSource.readRecordArray(onReadComplete);

        expect(onReadComplete).toHaveBeenCalledWith([

            new RealTaskRecord("2015-04-03", "2015-04-06"),
            new RealTaskRecord("2015-04-04", "2015-04-05"),
            new RealTaskRecord("2015-04-04", "2015-04-05")
        ]);
    });

    it("should cache the result and not use spreadsheet second time", function () {

        realTaskRecordSource.readRecordArray(onReadComplete);
        realTaskRecordSource.readRecordArray(onReadComplete);

        expect(googleSpreadSheet.readCellArray.calls.count()).toBe(1);
    });
});

describe("RealTaskRecord", function () {

    it("was active should be true if the given date is bigger than the start date but smaller than the end date", function () {

        var realTaskRecord = new RealTaskRecord("2015-04-10", "2015-05-01");

        expect(realTaskRecord.wasActive(new WorkDay("2015-04-09"))).toBe(false);
        expect(realTaskRecord.wasActive(new WorkDay("2015-04-10"))).toBe(true);
        expect(realTaskRecord.wasActive(new WorkDay("2015-04-20"))).toBe(true);
        expect(realTaskRecord.wasActive(new WorkDay("2015-04-30"))).toBe(true);
        expect(realTaskRecord.wasActive(new WorkDay("2015-05-01"))).toBe(false);
        expect(realTaskRecord.wasActive(new WorkDay("2015-05-02"))).toBe(false);
    });

    it("should create cycle time using start and the end dates", function () {

        var realTaskRecord = new RealTaskRecord("2015-04-10", "2015-05-01");

        expect(realTaskRecord.getCycleTime()).toBe(21);
    });
});

describe("WorkDay", function () {

    it("should be constructed by date string", function () {

        var workDay = new WorkDay("2015-04-17");

        expectDate(workDay, 2015, 4, 17);
    });

    it("should give the next day", function () {

        var workDay = new WorkDay("2015-04-17");
        var nextDay = workDay.getNextDay();

        expectDate(nextDay, 2015, 4, 18);
    });

    it("next day should successfully move to next year", function () {

        var workDay = new WorkDay("2015-12-31");
        var nextDay = workDay.getNextDay();

        expectDate(nextDay, 2016, 1, 1);
    });

    it("in between should return true if date is bigger and equal to first date and smaller than the second", function () {

        var workDay = new WorkDay("2015-04-17");

        expect(workDay.isInBetween(new WorkDay("2015-04-16"), new WorkDay("2015-04-18"))).toBe(true);
        expect(workDay.isInBetween(new WorkDay("2015-04-17"), new WorkDay("2015-04-18"))).toBe(true);
        expect(workDay.isInBetween(new WorkDay("2015-04-16"), new WorkDay("2015-04-17"))).toBe(false);
        expect(workDay.isInBetween(new WorkDay("2015-04-18"), new WorkDay("2015-04-19"))).toBe(false);
        expect(workDay.isInBetween(new WorkDay("2015-04-18"), new WorkDay("2015-04-16"))).toBe(false);
    });

    it("should give dayDifference between to workdays", function () {

        var firstWorkDay = new WorkDay("2015-04-17"),
            secondWorkDay = new WorkDay("2015-04-22");

        expect(secondWorkDay.dayDifference(firstWorkDay)).toBe(5);
    });

    it("smaller than", function () {

        var workDay = new WorkDay("2015-04-17");

        expect(workDay.smallerThan(new WorkDay("2015-04-16"))).toBe(false);
        expect(workDay.smallerThan(new WorkDay("2015-04-17"))).toBe(false);
        expect(workDay.smallerThan(new WorkDay("2015-04-18"))).toBe(true);
    });

    it("bigger than", function () {

        var workDay = new WorkDay("2015-04-17");

        expect(workDay.biggerThan(new WorkDay("2015-04-16"))).toBe(true);
        expect(workDay.biggerThan(new WorkDay("2015-04-17"))).toBe(false);
        expect(workDay.biggerThan(new WorkDay("2015-04-18"))).toBe(false);
    });

    function expectDate(dateToCheck, year, month, day) {

        expect(dateToCheck.date.getDate()).toBe(day);
        expect(dateToCheck.date.getMonth()).toBe(month - 1);
        expect(dateToCheck.date.getFullYear()).toBe(year);
    }
});

describe("Bowl", function () {

    var randomPicker,
        bowl;

    beforeEach(function () {

        randomPicker = jasmine.createSpyObj("randomPicker", ["pickFromArray"]);
        bowl = new BowlFactory(randomPicker).createBowl();
    });

    it("can pick a random element of it's content", function () {

        bowl.add("a");
        bowl.add("b");
        bowl.add("c");

        randomPicker.pickFromArray.and.returnValue("b");

        var picked = bowl.pick();

        expect(randomPicker.pickFromArray).toHaveBeenCalledWith(["a", "b", "c"]);
        expect(picked).toBe("b");
    });

    it("can pick a random array of elements of it's content", function () {

        bowl.add("a");
        bowl.add("b");
        bowl.add("c");

        var randomArray = ["b", "a", "c", "a"];
        randomPicker.pickFromArray.and.callFake(function () {

            return randomArray.shift();
        });

        var pickedArray = bowl.pickMultiple(4);

        expect(randomPicker.pickFromArray).toHaveBeenCalledWith(["a", "b", "c"]);
        expect(randomPicker.pickFromArray.calls.count()).toBe(4);
        expect(pickedArray).toEqual(["b", "a", "c", "a"]);
    });

    it("should throw a range error if empty", function () {

        expect(bowl.pick).toThrow();
        expect(bowl.pickMultiple.bind(bowl, 2)).toThrow();
    });
});

describe("RandomPicker", function () {

    var sourceArray = ["a", "b", "c", "d"],
        randomizer,
        randomPicker;

    beforeEach(function () {

        randomizer = jasmine.createSpyObj("randomizer", ["random"]);
        randomPicker = new RandomPicker(randomizer);
    });

    it("should pick first element of the array if the random number is 0", function () {

        randomizer.random.and.returnValue(0);
        expect(randomPicker.pickFromArray(sourceArray)).toBe("a");
    });

    it("should pick last element of the array if the random number is 0.99", function () {

        randomizer.random.and.returnValue(0.99);
        expect(randomPicker.pickFromArray(sourceArray)).toBe("d");
    });

    it("should pick the second element if the random number is 0.33", function () {

        randomizer.random.and.returnValue(0.33);
        expect(randomPicker.pickFromArray(sourceArray)).toBe("b");
    });
});