from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="BulkActionType4")



@_attrs_define
class BulkActionType4:
    """ 
        Attributes:
            type_ (Literal['move']):
            project_key (str):
            issue_type (str | Unset):
            status_id (UUID | Unset):
     """

    type_: Literal['move']
    project_key: str
    issue_type: str | Unset = UNSET
    status_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        project_key = self.project_key

        issue_type = self.issue_type

        status_id: str | Unset = UNSET
        if not isinstance(self.status_id, Unset):
            status_id = str(self.status_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "projectKey": project_key,
        })
        if issue_type is not UNSET:
            field_dict["issueType"] = issue_type
        if status_id is not UNSET:
            field_dict["statusId"] = status_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['move'] , d.pop("type"))
        if type_ != 'move':
            raise ValueError(f"type must match const 'move', got '{type_}'")

        project_key = d.pop("projectKey")

        issue_type = d.pop("issueType", UNSET)

        _status_id = d.pop("statusId", UNSET)
        status_id: UUID | Unset
        if isinstance(_status_id,  Unset):
            status_id = UNSET
        else:
            status_id = UUID(_status_id)




        bulk_action_type_4 = cls(
            type_=type_,
            project_key=project_key,
            issue_type=issue_type,
            status_id=status_id,
        )


        bulk_action_type_4.additional_properties = d
        return bulk_action_type_4

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
