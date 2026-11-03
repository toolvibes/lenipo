from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.control_chart_cycle import ControlChartCycle
  from ..models.control_chart_lead import ControlChartLead
  from ..models.control_chart_points_item import ControlChartPointsItem





T = TypeVar("T", bound="ControlChart")



@_attrs_define
class ControlChart:
    """ 
        Attributes:
            points (list[ControlChartPointsItem]):
            lead (ControlChartLead):
            cycle (ControlChartCycle):
            truncated (bool):
     """

    points: list[ControlChartPointsItem]
    lead: ControlChartLead
    cycle: ControlChartCycle
    truncated: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.control_chart_cycle import ControlChartCycle # noqa: PLC0415
        from ..models.control_chart_lead import ControlChartLead # noqa: PLC0415
        from ..models.control_chart_points_item import ControlChartPointsItem # noqa: PLC0415
        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)



        lead = self.lead.to_dict()

        cycle = self.cycle.to_dict()

        truncated = self.truncated


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "points": points,
            "lead": lead,
            "cycle": cycle,
            "truncated": truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.control_chart_cycle import ControlChartCycle # noqa: PLC0415
        from ..models.control_chart_lead import ControlChartLead # noqa: PLC0415
        from ..models.control_chart_points_item import ControlChartPointsItem # noqa: PLC0415
        d = dict(src_dict)
        points = []
        _points = d.pop("points")
        for points_item_data in (_points):
            points_item = ControlChartPointsItem.from_dict(points_item_data)



            points.append(points_item)


        lead = ControlChartLead.from_dict(d.pop("lead"))




        cycle = ControlChartCycle.from_dict(d.pop("cycle"))




        truncated = d.pop("truncated")

        control_chart = cls(
            points=points,
            lead=lead,
            cycle=cycle,
            truncated=truncated,
        )

        return control_chart

