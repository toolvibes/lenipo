from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="BulkActionType2")



@_attrs_define
class BulkActionType2:
    """ 
        Attributes:
            type_ (Literal['sprint']):
            sprint_id (None | UUID):
     """

    type_: Literal['sprint']
    sprint_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        sprint_id: None | str
        if isinstance(self.sprint_id, UUID):
            sprint_id = str(self.sprint_id)
        else:
            sprint_id = self.sprint_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "sprintId": sprint_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['sprint'] , d.pop("type"))
        if type_ != 'sprint':
            raise ValueError(f"type must match const 'sprint', got '{type_}'")

        def _parse_sprint_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sprint_id_type_0 = UUID(data)



                return sprint_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        sprint_id = _parse_sprint_id(d.pop("sprintId"))


        bulk_action_type_2 = cls(
            type_=type_,
            sprint_id=sprint_id,
        )


        bulk_action_type_2.additional_properties = d
        return bulk_action_type_2

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
