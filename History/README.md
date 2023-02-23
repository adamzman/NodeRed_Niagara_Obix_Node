## Niagara Obix History Node

> **ENSURE README IS FOR CORRECT VERSION OF INSTALLED PACKAGE**

Returns Histories from the connected Niagara station

- **Path** - Used to indicate which history to interact with... path starts after histories... ex. `history:/History_Demo/Global$2fOutside_Air_Temp`, only take `"History_Demo/Global$2fOutside_Air_Temp"`.
- **Type** - Either use a preset query or custom history query.
- **Query** - Preset history query or custom query (More details below).

### Dynamic Values

Passing the following values will **override** the default values you may pre-configured.

- `msg.username` -> Username (String)
- `msg.password` -> Password (String)
- `msg.credentialsKey` -> Key used to obtain credentials from Node-RED settings file (Overrides `msg.username` and `msg.password`) (String)
- `msg.protocol` -> 'https' or 'http' (String)
- `msg.host` -> IP Address (String)
- `msg.port` -> HTTPS/HTTP Port (Number)
- `msg.path` -> Path (String)
- `msg.presetQuery` -> Preset history query (String : Values must be one of the following)

  - "yesterday"
  - "last24Hours"
  - "weekToDate"
  - "lastWeek"
  - "last7Days"
  - "monthToDate"
  - "lastMonth"
  - "yearToDate (limit=1000)"
  - "lastYear (limit=1000)"
  - "unboundedQuery"

- `msg.historyQuery` -> Custom history query used to specify what time period and how many records you want to read from a history (Object)
  - Basic query format
    ```
    {
      "start": "2020-10-11T12:40:05-04:00",
      "end": "2020-10-14T12:40:05-04:00" || Date.now(),
      "limit": "2"
    }
    ```
  - **Start and end can be in any JS Date format**
  - Start and end are the periods of reading data, and the limit is the number of records returned.
  - If there are more records than the limit allows, then it returns the number of records starting from the start time.
