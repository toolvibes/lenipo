from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="SetCapacityRequest")



@_attrs_define
class SetCapacityRequest:
    """ 
        Attributes:
            project_key (str):
            month (datetime.date):
            points (float | None):
     """

    project_key: str
    month: datetime.date
    points: float | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        project_key = self.project_key

        month = self.month.isoformat()

        points: float | None
        points = self.points


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "projectKey": project_key,
            "month": month,
            "points": points,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        project_key = d.pop("projectKey")

        month = datetime.date.fromisoformat(d.pop("month"))




        def _parse_points(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        points = _parse_points(d.pop("points"))


        set_capacity_request = cls(
            project_key=project_key,
            month=month,
            points=points,
        )


        set_capacity_request.additional_properties = d
        return set_capacity_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
