from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UpdateComponentRequest")



@_attrs_define
class UpdateComponentRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            lead_id (None | Unset | UUID):
            default_assignee_id (None | Unset | UUID):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    lead_id: None | Unset | UUID = UNSET
    default_assignee_id: None | Unset | UUID = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        lead_id: None | str | Unset
        if isinstance(self.lead_id, Unset):
            lead_id = UNSET
        elif isinstance(self.lead_id, UUID):
            lead_id = str(self.lead_id)
        else:
            lead_id = self.lead_id

        default_assignee_id: None | str | Unset
        if isinstance(self.default_assignee_id, Unset):
            default_assignee_id = UNSET
        elif isinstance(self.default_assignee_id, UUID):
            default_assignee_id = str(self.default_assignee_id)
        else:
            default_assignee_id = self.default_assignee_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if lead_id is not UNSET:
            field_dict["leadId"] = lead_id
        if default_assignee_id is not UNSET:
            field_dict["defaultAssigneeId"] = default_assignee_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        def _parse_lead_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                lead_id_type_0 = UUID(data)



                return lead_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        lead_id = _parse_lead_id(d.pop("leadId", UNSET))


        def _parse_default_assignee_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_assignee_id_type_0 = UUID(data)



                return default_assignee_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        default_assignee_id = _parse_default_assignee_id(d.pop("defaultAssigneeId", UNSET))


        update_component_request = cls(
            name=name,
            description=description,
            lead_id=lead_id,
            default_assignee_id=default_assignee_id,
        )


        update_component_request.additional_properties = d
        return update_component_request

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
