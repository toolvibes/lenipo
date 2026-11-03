from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.update_sprint_request_capacity import UpdateSprintRequestCapacity





T = TypeVar("T", bound="UpdateSprintRequest")



@_attrs_define
class UpdateSprintRequest:
    """ 
        Attributes:
            name (str | Unset):
            goal (str | Unset):
            start_date (datetime.date | None | Unset):
            end_date (datetime.date | None | Unset):
            capacity (UpdateSprintRequestCapacity | Unset):
     """

    name: str | Unset = UNSET
    goal: str | Unset = UNSET
    start_date: datetime.date | None | Unset = UNSET
    end_date: datetime.date | None | Unset = UNSET
    capacity: UpdateSprintRequestCapacity | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_sprint_request_capacity import UpdateSprintRequestCapacity # noqa: PLC0415
        name = self.name

        goal = self.goal

        start_date: None | str | Unset
        if isinstance(self.start_date, Unset):
            start_date = UNSET
        elif isinstance(self.start_date, datetime.date):
            start_date = self.start_date.isoformat()
        else:
            start_date = self.start_date

        end_date: None | str | Unset
        if isinstance(self.end_date, Unset):
            end_date = UNSET
        elif isinstance(self.end_date, datetime.date):
            end_date = self.end_date.isoformat()
        else:
            end_date = self.end_date

        capacity: dict[str, Any] | Unset = UNSET
        if not isinstance(self.capacity, Unset):
            capacity = self.capacity.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if goal is not UNSET:
            field_dict["goal"] = goal
        if start_date is not UNSET:
            field_dict["startDate"] = start_date
        if end_date is not UNSET:
            field_dict["endDate"] = end_date
        if capacity is not UNSET:
            field_dict["capacity"] = capacity

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_sprint_request_capacity import UpdateSprintRequestCapacity # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        goal = d.pop("goal", UNSET)

        def _parse_start_date(data: object) -> datetime.date | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                start_date_type_0 = datetime.date.fromisoformat(data)



                return start_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None | Unset, data)

        start_date = _parse_start_date(d.pop("startDate", UNSET))


        def _parse_end_date(data: object) -> datetime.date | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                end_date_type_0 = datetime.date.fromisoformat(data)



                return end_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None | Unset, data)

        end_date = _parse_end_date(d.pop("endDate", UNSET))


        _capacity = d.pop("capacity", UNSET)
        capacity: UpdateSprintRequestCapacity | Unset
        if isinstance(_capacity,  Unset):
            capacity = UNSET
        else:
            capacity = UpdateSprintRequestCapacity.from_dict(_capacity)




        update_sprint_request = cls(
            name=name,
            goal=goal,
            start_date=start_date,
            end_date=end_date,
            capacity=capacity,
        )


        update_sprint_request.additional_properties = d
        return update_sprint_request

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
