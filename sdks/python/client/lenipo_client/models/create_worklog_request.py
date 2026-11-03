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
  from ..models.remaining_adjustment_type_0 import RemainingAdjustmentType0
  from ..models.remaining_adjustment_type_1 import RemainingAdjustmentType1
  from ..models.remaining_adjustment_type_2 import RemainingAdjustmentType2





T = TypeVar("T", bound="CreateWorklogRequest")



@_attrs_define
class CreateWorklogRequest:
    """ 
        Attributes:
            time_spent (str):
            started (datetime.datetime | Unset):
            comment (str | Unset):  Default: ''.
            remaining (RemainingAdjustmentType0 | RemainingAdjustmentType1 | RemainingAdjustmentType2 | Unset):
     """

    time_spent: str
    started: datetime.datetime | Unset = UNSET
    comment: str | Unset = ''
    remaining: RemainingAdjustmentType0 | RemainingAdjustmentType1 | RemainingAdjustmentType2 | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.remaining_adjustment_type_0 import RemainingAdjustmentType0 # noqa: PLC0415
        from ..models.remaining_adjustment_type_1 import RemainingAdjustmentType1 # noqa: PLC0415
        from ..models.remaining_adjustment_type_2 import RemainingAdjustmentType2 # noqa: PLC0415
        time_spent = self.time_spent

        started: str | Unset = UNSET
        if not isinstance(self.started, Unset):
            started = self.started.isoformat()

        comment = self.comment

        remaining: dict[str, Any] | Unset
        if isinstance(self.remaining, Unset):
            remaining = UNSET
        elif isinstance(self.remaining, RemainingAdjustmentType0):
            remaining = self.remaining.to_dict()
        elif isinstance(self.remaining, RemainingAdjustmentType1):
            remaining = self.remaining.to_dict()
        else:
            remaining = self.remaining.to_dict()



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "timeSpent": time_spent,
        })
        if started is not UNSET:
            field_dict["started"] = started
        if comment is not UNSET:
            field_dict["comment"] = comment
        if remaining is not UNSET:
            field_dict["remaining"] = remaining

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.remaining_adjustment_type_0 import RemainingAdjustmentType0 # noqa: PLC0415
        from ..models.remaining_adjustment_type_1 import RemainingAdjustmentType1 # noqa: PLC0415
        from ..models.remaining_adjustment_type_2 import RemainingAdjustmentType2 # noqa: PLC0415
        d = dict(src_dict)
        time_spent = d.pop("timeSpent")

        _started = d.pop("started", UNSET)
        started: datetime.datetime | Unset
        if isinstance(_started,  Unset):
            started = UNSET
        else:
            started = datetime.datetime.fromisoformat(_started)




        comment = d.pop("comment", UNSET)

        def _parse_remaining(data: object) -> RemainingAdjustmentType0 | RemainingAdjustmentType1 | RemainingAdjustmentType2 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_remaining_adjustment_type_0 = RemainingAdjustmentType0.from_dict(data)



                return componentsschemas_remaining_adjustment_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_remaining_adjustment_type_1 = RemainingAdjustmentType1.from_dict(data)



                return componentsschemas_remaining_adjustment_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_remaining_adjustment_type_2 = RemainingAdjustmentType2.from_dict(data)



            return componentsschemas_remaining_adjustment_type_2

        remaining = _parse_remaining(d.pop("remaining", UNSET))


        create_worklog_request = cls(
            time_spent=time_spent,
            started=started,
            comment=comment,
            remaining=remaining,
        )


        create_worklog_request.additional_properties = d
        return create_worklog_request

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
