from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.plan import Plan
  from ..models.plan_scenario import PlanScenario
  from ..models.plan_view_capacity_item import PlanViewCapacityItem
  from ..models.plan_view_projects_item import PlanViewProjectsItem





T = TypeVar("T", bound="PlanView")



@_attrs_define
class PlanView:
    """ 
        Attributes:
            plan (Plan):
            scenarios (list[PlanScenario]):
            scenario_id (None | UUID):
            projects (list[PlanViewProjectsItem]):
            capacity (list[PlanViewCapacityItem]):
     """

    plan: Plan
    scenarios: list[PlanScenario]
    scenario_id: None | UUID
    projects: list[PlanViewProjectsItem]
    capacity: list[PlanViewCapacityItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.plan import Plan # noqa: PLC0415
        from ..models.plan_scenario import PlanScenario # noqa: PLC0415
        from ..models.plan_view_capacity_item import PlanViewCapacityItem # noqa: PLC0415
        from ..models.plan_view_projects_item import PlanViewProjectsItem # noqa: PLC0415
        plan = self.plan.to_dict()

        scenarios = []
        for scenarios_item_data in self.scenarios:
            scenarios_item = scenarios_item_data.to_dict()
            scenarios.append(scenarios_item)



        scenario_id: None | str
        if isinstance(self.scenario_id, UUID):
            scenario_id = str(self.scenario_id)
        else:
            scenario_id = self.scenario_id

        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)



        capacity = []
        for capacity_item_data in self.capacity:
            capacity_item = capacity_item_data.to_dict()
            capacity.append(capacity_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "plan": plan,
            "scenarios": scenarios,
            "scenarioId": scenario_id,
            "projects": projects,
            "capacity": capacity,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan import Plan # noqa: PLC0415
        from ..models.plan_scenario import PlanScenario # noqa: PLC0415
        from ..models.plan_view_capacity_item import PlanViewCapacityItem # noqa: PLC0415
        from ..models.plan_view_projects_item import PlanViewProjectsItem # noqa: PLC0415
        d = dict(src_dict)
        plan = Plan.from_dict(d.pop("plan"))




        scenarios = []
        _scenarios = d.pop("scenarios")
        for scenarios_item_data in (_scenarios):
            scenarios_item = PlanScenario.from_dict(scenarios_item_data)



            scenarios.append(scenarios_item)


        def _parse_scenario_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                scenario_id_type_0 = UUID(data)



                return scenario_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        scenario_id = _parse_scenario_id(d.pop("scenarioId"))


        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = PlanViewProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        capacity = []
        _capacity = d.pop("capacity")
        for capacity_item_data in (_capacity):
            capacity_item = PlanViewCapacityItem.from_dict(capacity_item_data)



            capacity.append(capacity_item)


        plan_view = cls(
            plan=plan,
            scenarios=scenarios,
            scenario_id=scenario_id,
            projects=projects,
            capacity=capacity,
        )

        return plan_view

