from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UpdateSpaceRequest")



@_attrs_define
class UpdateSpaceRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            home_page_id (None | Unset | UUID):
            project_key (None | str | Unset):
            approval_required (bool | Unset):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    home_page_id: None | Unset | UUID = UNSET
    project_key: None | str | Unset = UNSET
    approval_required: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        home_page_id: None | str | Unset
        if isinstance(self.home_page_id, Unset):
            home_page_id = UNSET
        elif isinstance(self.home_page_id, UUID):
            home_page_id = str(self.home_page_id)
        else:
            home_page_id = self.home_page_id

        project_key: None | str | Unset
        if isinstance(self.project_key, Unset):
            project_key = UNSET
        else:
            project_key = self.project_key

        approval_required = self.approval_required


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if home_page_id is not UNSET:
            field_dict["homePageId"] = home_page_id
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key
        if approval_required is not UNSET:
            field_dict["approvalRequired"] = approval_required

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        def _parse_home_page_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                home_page_id_type_0 = UUID(data)



                return home_page_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        home_page_id = _parse_home_page_id(d.pop("homePageId", UNSET))


        def _parse_project_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        project_key = _parse_project_key(d.pop("projectKey", UNSET))


        approval_required = d.pop("approvalRequired", UNSET)

        update_space_request = cls(
            name=name,
            description=description,
            home_page_id=home_page_id,
            project_key=project_key,
            approval_required=approval_required,
        )


        update_space_request.additional_properties = d
        return update_space_request

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
