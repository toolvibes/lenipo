from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="FilterShareInputType2")



@_attrs_define
class FilterShareInputType2:
    """ 
        Attributes:
            type_ (Literal['project']):
            project_id (UUID):
     """

    type_: Literal['project']
    project_id: UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        project_id = str(self.project_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "projectId": project_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['project'] , d.pop("type"))
        if type_ != 'project':
            raise ValueError(f"type must match const 'project', got '{type_}'")

        project_id = UUID(d.pop("projectId"))




        filter_share_input_type_2 = cls(
            type_=type_,
            project_id=project_id,
        )


        filter_share_input_type_2.additional_properties = d
        return filter_share_input_type_2

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
