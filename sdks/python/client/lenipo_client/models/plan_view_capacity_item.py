from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="PlanViewCapacityItem")



@_attrs_define
class PlanViewCapacityItem:
    """ 
        Attributes:
            project_key (str):
            month (datetime.date):
            capacity (float | None):
            planned (float):
     """

    project_key: str
    month: datetime.date
    capacity: float | None
    planned: float





    def to_dict(self) -> dict[str, Any]:
        project_key = self.project_key

        month = self.month.isoformat()

        capacity: float | None
        capacity = self.capacity

        planned = self.planned


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "projectKey": project_key,
            "month": month,
            "capacity": capacity,
            "planned": planned,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        project_key = d.pop("projectKey")

        month = datetime.date.fromisoformat(d.pop("month"))




        def _parse_capacity(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        capacity = _parse_capacity(d.pop("capacity"))


        planned = d.pop("planned")

        plan_view_capacity_item = cls(
            project_key=project_key,
            month=month,
            capacity=capacity,
            planned=planned,
        )

        return plan_view_capacity_item

