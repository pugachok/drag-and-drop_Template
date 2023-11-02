@isTest
private class DNDSortingControllerTest {
    @TestSetup
    static void makeData(){
        List<Account> accounts = new List<Account>();
        accounts.add(new Account(Name = 'Test Account 1'));
        accounts.add(new Account(Name = 'Test Account 2'));
        insert accounts;
    }

    @isTest
    static void testScenario0() {
        // Positive scenario
        DNDSortingController.saveSorting([SELECT Id, Name, NumberOfEmployees FROM Account], 'NumberOfEmployees');
        List<Account> sortedAccs = [SELECT Id, Name FROM Account ORDER BY NumberOfEmployees];
        Assert.isTrue(sortedAccs[0].Name == 'Test Account 1');
        Assert.isTrue(sortedAccs[1].Name == 'Test Account 2');
    }

    @isTest
    static void testScenario1() {
        // Negative scenario
        Boolean isException = false;
        try {
            DNDSortingController.saveSorting(null, null);
        }
        catch (Exception e) {
            isException = true;
        }
        Assert.isTrue(isException);
    }
}