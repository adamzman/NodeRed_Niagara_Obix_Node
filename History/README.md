## Niagara Obix History Node

Returns Histories from the connected Niagara Station

-   **Path** - Used to indicate which history you want to interact with... Path starts after histories... ex. histories/TestHistories/History, only take "TestHistories/History".
-   **Preset Query** - Preset history queries. Can be overridden with a custom query by passing in msg.historyQuery (More details below).

### Dynamic Values

Each instance of the Niagara Obix Node can have its values inserted dynamically. Each dynamic value has the same functionality as the values above. Passing the following values will **override** the default values you may pre-configured.

-   `msg.username` -> Username (String)
-   `msg.password` -> Password (String)
-   `msg.host` -> IP Address (String)
-   `msg.protocol` -> 'https' or 'http' (String)
-   `msg.port` -> HTTPS/HTTP Port (Number)
-   `msg.path` -> Path (String)
-   `msg.historyQuery` -> History Query (Overrides the PresetQuery Selection) (JSON Object : See formatting options below)
-   `msg.presetQuery` -> Use a Preset History Query (Overrides the PresetQuery Selection) (String : Values must be one of the following)

    -   "yesterday"
    -   "last24Hours"
    -   "weekToDate"
    -   "lastWeek"
    -   "last7Days"
    -   "monthToDate"
    -   "lastMonth"
    -   "yearToDate (limit=1000)"
    -   "lastYear (limit=1000)"
    -   "unboundedQuery"

-   **msg.historyQuery** - Used to specify what time period and how many records you want to read from a history...
    -   Basic Query format `{"start": "2020-10-11T12:40:05-04:00", "end": "2020-10-14T12:40:05-04:00", "limit": "2"}`.
    -   Start and end are the periods of reading data, and the limit is the number of records returned.
    -   If there are more records than the limit allows, then it returns the number of records starting from the start time.
