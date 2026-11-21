# Data format

topoview reads one JSON file that describes devices and the cables between
them. [subnetplan](https://github.com/rezarg-dev/subnetplan) writes this
file as `topology.json`, but nothing in topoview depends on that tool: any
file of this shape can be opened.

```json
{
  "name": "lab",
  "nodes": [
    { "id": "R1", "kind": "router", "site": "main", "router_id": "1.1.1.1" },
    {
      "id": "SW1",
      "kind": "switch",
      "site": "main",
      "management_address": "10.0.0.146",
      "vlans": [{ "id": 10, "name": "users", "network": "10.0.0.0/25" }]
    },
    { "id": "internet", "kind": "cloud" }
  ],
  "links": [
    {
      "source": "R1",
      "target": "SW1",
      "kind": "trunk",
      "source_interface": "GigabitEthernet0/0",
      "target_interface": "GigabitEthernet0/1",
      "vlans": [10]
    },
    {
      "source": "R1",
      "target": "internet",
      "kind": "uplink",
      "network": "203.0.113.0/30",
      "source_interface": "GigabitEthernet0/2",
      "source_address": "203.0.113.2",
      "target_address": "203.0.113.1"
    }
  ]
}
```

## Top level

| Key | Required | Meaning |
| --- | --- | --- |
| `name` | no | Shown in the header and used as the file name when saving. Default `network` |
| `nodes` | yes | At least one device |
| `links` | yes | May be empty |

## Nodes

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Unique name, shown as the label |
| `kind` | yes | `router`, `switch` or `cloud` |
| `site` | no | Shown in the details panel |
| `router_id` | no | Routers: shown in the details panel |
| `summary` | no | Routers: the summary route of the site |
| `management_address` | no | Switches: shown in the details panel |
| `vlans` | no | Switches: list of `{ "id", "name", "network" }`. These feed the VLAN buttons |

## Links

| Key | Required | Meaning |
| --- | --- | --- |
| `source`, `target` | yes | Ids of two nodes |
| `kind` | yes | `trunk` (router to switch), `wan` (router to router) or `uplink` (to a cloud) |
| `source_interface`, `target_interface` | no | Shown next to each end of the line, abbreviated (`Gi0/1`) |
| `source_address`, `target_address` | no | Shown in the details panel |
| `network` | no | Subnet of the link |
| `vlans` | no | Trunks: VLAN ids carried. A VLAN is highlighted on a trunk only if it is listed here |

## Validation

A file is checked completely before the diagram on screen is replaced. If
anything is wrong, the current diagram stays and every problem is listed
with its position, for example:

```
This file cannot be shown:
nodes[2]: "kind" must be one of router, switch, cloud
links[0]: target "SW9" is not a node
```

Unknown keys are ignored, so a file may carry extra information for other
tools.

## Layout

Positions are not part of the file. Routers are placed in a row in the
order they appear in `nodes`, each switch below the router it is trunked
to, and the cloud above the router it connects to. A link that would run
through another device is drawn as a curve.
