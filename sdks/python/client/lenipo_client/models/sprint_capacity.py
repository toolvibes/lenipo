from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.sprint_capacity_people_item import SprintCapacityPeopleItem





T = TypeVar("T", bound="SprintCapacity")



@_attrs_define
class SprintCapacity:
    """ 
        Attributes:
            total (float | None):
            people (list[SprintCapacityPeopleItem]):
     """

    total: float | None
    people: list[SprintCapacityPeopleItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.sprint_capacity_people_item import SprintCapacityPeopleItem # noqa: PLC0415
        total: float | None
        total = self.total

        people = []
        for people_item_data in self.people:
            people_item = people_item_data.to_dict()
            people.append(people_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "total": total,
            "people": people,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sprint_capacity_people_item import SprintCapacityPeopleItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_total(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        total = _parse_total(d.pop("total"))


        people = []
        _people = d.pop("people")
        for people_item_data in (_people):
            people_item = SprintCapacityPeopleItem.from_dict(people_item_data)



            people.append(people_item)


        sprint_capacity = cls(
            total=total,
            people=people,
        )

        return sprint_capacity

