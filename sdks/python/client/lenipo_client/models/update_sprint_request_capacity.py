from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.update_sprint_request_capacity_people_item import UpdateSprintRequestCapacityPeopleItem





T = TypeVar("T", bound="UpdateSprintRequestCapacity")



@_attrs_define
class UpdateSprintRequestCapacity:
    """ 
        Attributes:
            total (float | None):
            people (list[UpdateSprintRequestCapacityPeopleItem]):
     """

    total: float | None
    people: list[UpdateSprintRequestCapacityPeopleItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_sprint_request_capacity_people_item import UpdateSprintRequestCapacityPeopleItem # noqa: PLC0415
        total: float | None
        total = self.total

        people = []
        for people_item_data in self.people:
            people_item = people_item_data.to_dict()
            people.append(people_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "total": total,
            "people": people,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_sprint_request_capacity_people_item import UpdateSprintRequestCapacityPeopleItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_total(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        total = _parse_total(d.pop("total"))


        people = []
        _people = d.pop("people")
        for people_item_data in (_people):
            people_item = UpdateSprintRequestCapacityPeopleItem.from_dict(people_item_data)



            people.append(people_item)


        update_sprint_request_capacity = cls(
            total=total,
            people=people,
        )


        update_sprint_request_capacity.additional_properties = d
        return update_sprint_request_capacity

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
